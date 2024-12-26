// Define the date range for the image collection.
var startDate = '2019-10-05';
var endDate = '2019-12-06';

// Define the coordinates for the Kosi Basin region.
var kosiBasinCoords = [
  [84.3385787995524, 22.290213141728405],
  [91.2599655183024, 22.15800096320843],
  [90.9633346589274, 26.126933775055694],
  [84.8439498933024, 26.491320646359558],
  [84.3385787995524, 22.290213141728405]  // Closing the polygon by repeating the first coordinate
];

// Create a polygon geometry.
var kosiBasin = ee.Geometry.Polygon(kosiBasinCoords);

// Load Sentinel-1 image collection, filtered by region, date, and orbit properties.
var s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'));

// Grab the first image in the collection.
var s1Image = s1Collection.first();

// Add the Sentinel-1 image to the map.
Map.addLayer(s1Image, {
    min: -25,
    max: 0,
    bands: 'VV'
}, 'Sentinel-1 image');

// Define the polarization band to use.
var band = 'VV';

// Define a reducer to calculate a histogram of values.
var histogramReducer = ee.Reducer.histogram(500, 0.1);

// Compute the histogram for the selected band.
var globalHistogram = ee.Dictionary(
    s1Image.select(band).reduceRegion({
        reducer: histogramReducer,
        geometry: s1Image.geometry(),
        scale: 90,
        maxPixels: 1e10
    }).get(band)
);

// Extract the histogram data: bucket means and histogram counts.
var x = ee.List(globalHistogram.get('bucketMeans'));
var y = ee.List(globalHistogram.get('histogram'));

// Create a data collection for plotting.
var dataCol = ee.Array.cat([x, y], 1).toList();

// Define the header information for the chart.
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
    }]
]);

// Combine the header and data into a data table.
var dataTable = columnHeader.cat(dataCol);

// Plot the histogram with an initial chart.
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

// Function to compute Otsu threshold.
function otsu(histogram) {
    var counts = ee.Array(histogram.get('histogram'));
    var means = ee.Array(histogram.get('bucketMeans'));
    var size = means.length().get([0]);
    var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);
    var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);
    var mean = sum.divide(total);
    var indices = ee.List.sequence(1, size);
    var bss = indices.map(function(i) {
        var aCounts = counts.slice(0, 0, i);
        var aCount = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]);
        var aMeans = means.slice(0, 0, i);
        var aMean = aMeans.multiply(aCounts)
            .reduce(ee.Reducer.sum(), [0]).get([0])
            .divide(aCount);
        var bCount = total.subtract(aCount);
        var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount);
        return aCount.multiply(aMean.subtract(mean).pow(2))
            .add(bCount.multiply(bMean.subtract(mean).pow(2)));
    });
    return means.sort(bss).get([-1]);
}

// Apply otsu thresholding and adjust the threshold manually.
var adjustmentFactor = -2;  // Lower the threshold by 2 dB (can be tweaked)
var globalThreshold = otsu(globalHistogram).add(adjustmentFactor);  // Adjust Otsu threshold

print('Adjusted global threshold value:', globalThreshold);

// Create an empty list for annotation.
var thresholdCol = ee.List.repeat('', x.length());
// Find the index where the bucketMean equals the threshold.
var threshIndex = x.indexOf(globalThreshold);
thresholdCol = thresholdCol.set(threshIndex, 'Adjusted Threshold');

// Redefine the column header with annotation.
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

// Loop through the data and add the annotation column.
dataCol = ee.List.sequence(0, x.length().subtract(1)).map(function(i) {
    i = ee.Number(i);
    var row = ee.List(dataCol.get(i));
    return row.add(ee.String(thresholdCol.get(i)));
});

// Concat the header and data for plotting.
dataTable = columnHeader.cat(dataCol);

// Plot the updated chart with the adjusted threshold annotation.
dataTable.evaluate(function(dataTableClient) {
    // Loop through the client-side table and set empty strings to null
    for (var i = 0; i < dataTableClient.length; i++) {
        if (dataTableClient[i][2] === '') {
            dataTableClient[i][2] = null;
        }
    }
    var chart = ui.Chart(dataTableClient)
        .setChartType('AreaChart')
        .setOptions({
            title: band + ' Global Histogram with Adjusted Threshold',
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

// Apply the adjusted threshold to extract water.
var globalWater = s1Image.select(band).lt(globalThreshold);

// Add the water image to the map with adjusted threshold.
Map.addLayer(globalWater.selfMask(), { palette: 'blue' }, 'Water (adjusted threshold)');
