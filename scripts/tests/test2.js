// Define the start and end dates for the image collection.
// Images will be filtered based on this time period.
var startDate = '2019-10-05';
var endDate = '2019-12-06';

// Coordinates defining the polygon for Kosi Basin. These points mark the boundary of the basin.
var kosiBasinCoords = [
    [86.9673115120579, 24.233773720924283],  // Point 1: Longitude, Latitude
    [89.3403583870579, 24.833437394900123],  // Point 2: Longitude, Latitude
    [89.0437275276829, 26.388752346995375],  // Point 3: Longitude, Latitude
    [86.5058857308079, 25.875863354380275],  // Point 4: Longitude, Latitude
    [86.9673115120579, 24.233773720924283]   // Closing the polygon by repeating the first coordinate
];

// Create a polygon geometry for Kosi Basin using the defined coordinates.
var kosiBasin = ee.Geometry.Polygon(kosiBasinCoords);

// Sentinel-1 image collection for the specific time period and geographical region.
// Filter the collection based on bounds (Kosi Basin), date range, orbit properties, and instrument mode.
var s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin)  // Filter by the geographical area of Kosi Basin.
    .filterDate(startDate, endDate)  // Filter by the date range between startDate and endDate.
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))  // Filter to include only ascending orbits.
    .filter(ee.Filter.eq('instrumentMode', 'IW'));  // Filter for Interferometric Wide (IW) mode for better coverage.

// Grab the first image in the collection for processing.
var s1Image = s1Collection.first();

// Add the first image to the map with specific visualization parameters.
Map.addLayer(s1Image, {
    min: -25,  // Minimum value for the color scale.
    max: 0,    // Maximum value for the color scale.
    bands: 'VV'  // Use the 'VV' polarization band for analysis.
}, 'Sentinel-1 image');  // Layer name in the map.


// Define the parameters for adaptive thresholding to detect water bodies in the image.
// These are used to fine-tune the detection of water from the radar backscatter.
var initialThreshold = -16;  // Initial estimate of water/no-water threshold.
var connectedPixels = 100;  // Minimum number of connected pixels to consider for length calculation.
var edgeLength = 20;  // Minimum edge length to be considered a water edge.
var edgeBuffer = 300;  // Buffer size (in meters) to be applied to the water edges.
var cannyThreshold = 1;  // Threshold for Canny edge detection.
var cannySigma = 1;  // Sigma value for the Gaussian filter used in Canny edge detection.
var cannyLt = 0.05;  // Lower threshold for Canny edge detection.

// Define the band used for processing (VV polarization).
var band = 'VV';

// Generate a binary mask for water bodies based on the initial threshold value.
// Values below the threshold are considered water, and above are non-water.
var binary = s1Image.select(band).lt(initialThreshold)
    .rename('binary');  // Renaming the output to 'binary' for clarity.

// Get projection information from the image to convert the buffer size (in meters) to pixel size.
var imageProj = s1Image.select(band).projection();

// Perform Canny edge detection to identify edges in the binary image.
var canny = ee.Algorithms.CannyEdgeDetector({
    image: binary,  // Input binary image.
    threshold: cannyThreshold,  // Canny edge detection threshold.
    sigma: cannySigma  // Sigma value for the Gaussian filter in edge detection.
});

// Process the Canny edge results to identify connected components.
// This step links adjacent pixels to form edges.
var connected = canny.updateMask(canny).lt(cannyLt)
    .connectedPixelCount(connectedPixels, true);  // Count connected pixels.

// Mask out short edges that may be noise (edges with fewer than the specified length).
var edges = connected.gte(edgeLength);  // Only keep edges with a length greater than or equal to edgeLength.

// Convert the buffer size (in meters) to pixel units based on the image projection.
var edgeBufferPixel = ee.Number(edgeBuffer).divide(imageProj.nominalScale());

// Apply a dilation operation (buffering) to the edges to identify the region around water bodies.
var bufferedEdges = edges.fastDistanceTransform().lt(edgeBufferPixel);

// Mask out areas not within the buffered edges to focus on the water areas.
var edgeImage = s1Image.select(band).updateMask(bufferedEdges);  // Apply the mask to the image.

// Create a histogram reducer to calculate the histogram of pixel values for the selected band.
var histogramReducer = ee.Reducer.histogram(255, 0.1);

// Reduce the image by calculating the histogram over the entire region.
var globalHistogram = ee.Dictionary(
    s1Image.select(band).reduceRegion({
        reducer: histogramReducer,  // Use the histogram reducer.
        geometry: s1Image.geometry(),  // Define the geometry (area) for the reduction.
        scale: 90,  // Set the scale for reduction (in meters).
        maxPixels: 1e10  // Max number of pixels to consider during the reduction.
    }).get(band)  // Extract the 'VV' band histogram.
);

// Extract the histogram bucket means and corresponding counts from the global histogram.
var x = ee.List(globalHistogram.get('bucketMeans'));  // Bucket mean values (backscatter levels).
var y = ee.List(globalHistogram.get('histogram'));    // Counts of pixels in each bucket.

// Combine the histogram data into a table for plotting.
var dataCol = ee.Array.cat([x, y], 1).toList();

// Define the header for the data table (labels for the chart).
var columnHeader = ee.List([
    [
        { label: 'Backscatter', role: 'domain', type: 'number' },
        { label: 'Values', role: 'data', type: 'number' }
    ]
]);

// Concatenate the header and data to create a full table for visualization.
var dataTable = columnHeader.cat(dataCol);

// Generate and display a chart of the global histogram of backscatter values.
dataTable.evaluate(function(dataTableClient) {
    var chart = ui.Chart(dataTableClient)
        .setChartType('AreaChart')  // Chart type (Area chart).
        .setOptions({
            title: band + ' Global Histogram',  // Chart title.
            hAxis: { title: 'Backscatter [dB]', viewWindow: { min: -35, max: 15 } },
            vAxis: { title: 'Count' }
        });
    print(chart);  // Print the chart to the console.
});

// Generate a local histogram for the edges (water bodies) in the image.
var localHistogram = ee.Dictionary(
    edgeImage.reduceRegion({
        reducer: histogramReducer,  // Use histogram reducer.
        geometry: s1Image.geometry(),  // Area of interest.
        scale: 90,  // Scale for reduction.
        maxPixels: 1e10  // Max number of pixels.
    }).get(band)
);

// Otsu thresholding function for automatic threshold calculation.
function otsu(histogram) {
    histogram = ee.Dictionary(histogram);  // Ensure the histogram is a dictionary.

    var counts = ee.Array(histogram.get('histogram'));  // Pixel counts per bucket.
    var means = ee.Array(histogram.get('bucketMeans'));  // Mean values of each bucket.

    var size = means.length().get([0]);  // Number of buckets.
    var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);  // Total pixel count.
    var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);  // Weighted sum of means.
    var mean = sum.divide(total);  // Global mean value.

    // Compute the between-sum-of-squares (BSS) for each threshold.
    var indices = ee.List.sequence(1, size);
    var bss = indices.map(function(i) {
        var aCounts = counts.slice(0, 0, i);  // Counts for class A.
        var aCount = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]);
        var aMeans = means.slice(0, 0, i);  // Means for class A.
        var aMean = aMeans.multiply(aCounts).reduce(ee.Reducer.sum(), [0]).get([0]).divide(aCount);

        var bCount = total.subtract(aCount);  // Counts for class B.
        var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount);  // Mean for class B.

        // Return the BSS for this threshold.
        return aCount.multiply(aMean.subtract(mean).pow(2))
            .add(bCount.multiply(bMean.subtract(mean).pow(2)));
    });

    // Return the threshold corresponding to the maximum BSS.
    return means.sort(bss).get([-1]);
}

// Apply Otsu thresholding to compute an adaptive threshold.
var localThreshold = otsu(localHistogram);
print('Adaptive threshold value:', localThreshold);  // Print the adaptive threshold value.

// Prepare the data for plotting with annotations showing the Otsu threshold.
var x = ee.List(localHistogram.get('bucketMeans'));  // Bucket mean values.
var y = ee.List(localHistogram.get('histogram'));    // Counts for each bucket.
var dataCol = ee.Array.cat([x, y], 1).toList();  // Combine data for plotting.

// Define the column header with an additional 'Threshold' annotation column.
var thresholdCol = ee.List.repeat('', x.length());
var threshIndex = x.indexOf(localThreshold);  // Find the index of the threshold.
thresholdCol = thresholdCol.set(threshIndex, 'Otsu Threshold');  // Annotate the threshold index.

// Rebuild the column header with the annotation column included.
columnHeader = ee.List([
    [
        { label: 'Backscatter', role: 'domain', type: 'number' },
        { label: 'Values', role: 'data', type: 'number' },
        { label: 'Threshold', role: 'annotation', type: 'string' }
    ]
]);

// Add the annotation column to the data for plotting.
dataCol = ee.List.sequence(0, x.length().subtract(1)).map(function(i) {
    i = ee.Number(i);
    var row = ee.List(dataCol.get(i));
    return row.add(ee.String(thresholdCol.get(i)));
});

// Combine header and data for the final plot table.
dataTable = columnHeader.cat(dataCol);

// Generate and display a chart with annotations marking the Otsu threshold.
dataTable.evaluate(function(dataTableClient) {
    // Replace empty strings with null for proper annotations.
    for (var i = 0; i < dataTableClient.length; i++) {
        if (dataTableClient[i][2] === '') {
            dataTableClient[i][2] = null;
        }
    }
    var chart = ui.Chart(dataTableClient)
        .setChartType('AreaChart')
        .setOptions({
            title: band + ' Adaptive Histogram with Threshold annotation',  // Chart title.
            hAxis: { title: 'Backscatter [dB]', viewWindow: { min: -35, max: 15 } },
            vAxis: { title: 'Count' },
            annotations: { style: 'line' }  // Display annotations as lines.
        });
    print(chart);  // Print the chart to the console.
});

// Add the detected water edges (in red) to the map for visualization.
Map.addLayer(edges, { palette: 'red' }, 'Detected water edges');

// Define the visualization parameters for the buffered water edges (yellow with opacity).
var edgesVis = {
    palette: 'yellow',
    opacity: 0.5
};

// Add the buffered edges (water body areas) to the map for visualization.
Map.addLayer(bufferedEdges.selfMask(), edgesVis, 'Buffered water edges');
