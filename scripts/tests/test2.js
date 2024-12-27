var startDate = '2019-10-05';
var endDate = '2019-12-06';
// '2019-10-05', '2019-10-06'

var kosiBasinCoords = [
  [86.9673115120579, 24.233773720924283],
  [89.3403583870579, 24.833437394900123],
  [89.0437275276829, 26.388752346995375],
  [86.5058857308079, 25.875863354380275],
  [86.9673115120579, 24.233773720924283] // Closing the polygon by repeating the first coordinate
];

// Create a polygon geometry.
var kosiBasin = ee.Geometry.Polygon(kosiBasinCoords);

var s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin)
    .filterDate(startDate, endDate) // Filter by date range
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'));

// Grab the first image in the collection.
var s1Image = s1Collection.first();

Map.addLayer(s1Image, {
    min: -25,
    max: 0,
    bands: 'VV'
}, 'Sentinel-1 image');

// Define parameters for the adaptive thresholding.
// Initial estimate of water/no-water for estimating the edges
var initialThreshold = -16;
// Number of connected pixels to use for length calculation.
var connectedPixels = 100;
// Length of edges to be considered water edges.
var edgeLength = 20;
// Buffer in meters to apply to edges.
var edgeBuffer = 300;
// Threshold for canny edge detection.
var cannyThreshold = 1;
// Sigma value for gaussian filter in canny edge detection.
var cannySigma = 1;
// Lower threshold for canny detection.
var cannyLt = 0.05;

var band = 'VV';
// Get preliminary water.
var binary = s1Image.select(band).lt(initialThreshold)
    .rename('binary');

// Get projection information to convert buffer size to pixels.
var imageProj = s1Image.select(band).projection();

// Get canny edges.
var canny = ee.Algorithms.CannyEdgeDetector({
    image: binary,
    threshold: cannyThreshold,
    sigma: cannySigma
});

// Process canny edges.

// Get the edges and length of edges.
var connected = canny.updateMask(canny).lt(cannyLt)
    .connectedPixelCount(connectedPixels, true);

// Mask short edges that can be noise.
var edges = connected.gte(edgeLength);

// Calculate the buffer in pixel size.
var edgeBufferPixel = ee.Number(edgeBuffer).divide(imageProj
    .nominalScale());

// Buffer the edges using a dilation operation.
var bufferedEdges = edges.fastDistanceTransform().lt(edgeBufferPixel);

// Mask areas not within the buffer .
var edgeImage = s1Image.select(band).updateMask(bufferedEdges);
var histogramReducer = ee.Reducer.histogram(255, 0.1);

// Reduce all of the image values.
var globalHistogram = ee.Dictionary(
    s1Image.select(band).reduceRegion({
        reducer: histogramReducer,
        geometry: s1Image.geometry(),
        scale: 90,
        maxPixels: 1e10
    }).get(band)
);

// Extract out the histogram buckets and counts per bucket.
var x = ee.List(globalHistogram.get('bucketMeans'));
var y = ee.List(globalHistogram.get('histogram'));

// Define a list of values to plot.
var dataCol = ee.Array.cat([x, y], 1).toList();

// Define the header information for data.
var columnHeader = ee.List([
    [
    {
        label: 'Backscatter',
        role: 'domain',
        type: 'number'
    },
    {
        label: 'Values',
        role: 'data',
        type: 'number'
    }, ]
]);

// Concat the header and data for plotting.
var dataTable = columnHeader.cat(dataCol);

// Create plot using the ui.Chart function with the dataTable.
// Use 'evaluate' to transfer the server-side table to the client.
// Define the chart and print it to the console.
dataTable.evaluate(function(dataTableClient) {
    var chart = ui.Chart(dataTableClient)
        .setChartType('AreaChart')
        .setOptions({
            title: band + ' Global Histogram',
            hAxis: {
                title: 'Backscatter [dB]',
                viewWindow: {
                    min: -35,
                    max: 15
                }
            },
            vAxis: {
                title: 'Count'
            }
        });
    print(chart);
});


var localHistogram = ee.Dictionary(
    edgeImage.reduceRegion({
        reducer: histogramReducer,
        geometry: s1Image.geometry(),
        scale: 90,
        maxPixels: 1e10
    }).get(band)
);
function otsu(histogram) {
    // Make sure histogram is an ee.Dictionary object.
    histogram = ee.Dictionary(histogram);
    // Extract relevant values into arrays.
    var counts = ee.Array(histogram.get('histogram'));
    var means = ee.Array(histogram.get('bucketMeans'));
    // Calculate single statistics over arrays
    var size = means.length().get([0]);
    var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);
    var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0])
        .get([0]);
    var mean = sum.divide(total);
    // Compute between sum of squares, where each mean partitions the data.
    var indices = ee.List.sequence(1, size);
    var bss = indices.map(function(i) {
        var aCounts = counts.slice(0, 0, i);
        var aCount = aCounts.reduce(ee.Reducer.sum(), [0])
            .get([0]);
        var aMeans = means.slice(0, 0, i);
        var aMean = aMeans.multiply(aCounts)
            .reduce(ee.Reducer.sum(), [0]).get([0])
            .divide(aCount);
        var bCount = total.subtract(aCount);
        var bMean = sum.subtract(aCount.multiply(aMean))
            .divide(bCount);
        return aCount.multiply(aMean.subtract(mean).pow(2))
            .add(
                bCount.multiply(bMean.subtract(mean).pow(2)));
    });
    // Return the mean value corresponding to the maximum BSS.
    return means.sort(bss).get([-1]);
}
// Apply otsu thresholding.
var localThreshold = otsu(localHistogram);
print('Adaptive threshold value:', localThreshold);

// Extract out the histogram buckets and counts per bucket.
var x = ee.List(localHistogram.get('bucketMeans'));
var y = ee.List(localHistogram.get('histogram'));

// Define a list of values to plot.
var dataCol = ee.Array.cat([x, y], 1).toList();

// Concat the header and data for plotting.
var dataTable = columnHeader.cat(dataCol);

// Create list of empty strings that will be used for annotation.
var thresholdCol = ee.List.repeat('', x.length());
// Find the index that bucketMean equals the threshold.
var threshIndex = x.indexOf(localThreshold);
// Set the index to the annotation text.
thresholdCol = thresholdCol.set(threshIndex, 'Otsu Threshold');

// Redefine the column header information now with annotation col.
columnHeader = ee.List([
    [
    {
        label: 'Backscatter',
        role: 'domain',
        type: 'number'
    },
    {
        label: 'Values',
        role: 'data',
        type: 'number'
    },
    {
        label: 'Threshold',
        role: 'annotation',
        type: 'string'
    }]
]);

// Loop through the data rows and add the annotation col.
dataCol = ee.List.sequence(0, x.length().subtract(1)).map(function(
i) {
    i = ee.Number(i);
    var row = ee.List(dataCol.get(i));
    return row.add(ee.String(thresholdCol.get(i)));
});

// Concat the header and data for plotting.
dataTable = columnHeader.cat(dataCol);

// Create plot using the ui.Chart function with the dataTable.
// Use 'evaluate' to transfer the server-side table to the client.
// Define the chart and print it to the console.
dataTable.evaluate(function(dataTableClient) {
    // Loop through the client-side table and set empty strings to null.
    for (var i = 0; i < dataTableClient.length; i++) {
        if (dataTableClient[i][2] === '') {
            dataTableClient[i][2] = null;
        }
    }
    var chart = ui.Chart(dataTableClient)
        .setChartType('AreaChart')
        .setOptions({
            title: band +
                ' Adaptive Histogram with Threshold annotation',
            hAxis: {
                title: 'Backscatter [dB]',
                viewWindow: {
                    min: -35,
                    max: 15
                }
            },
            vAxis: {
                title: 'Count'
            },
            annotations: {
                style: 'line'
            }
        });
    print(chart);
});

Map.addLayer(edges, {
    palette: 'red'
}, 'Detected water edges');
var edgesVis = {
    palette: 'yellow',
    opacity: 0.5
};
Map.addLayer(bufferedEdges.selfMask(), edgesVis,
    'Buffered water edges');