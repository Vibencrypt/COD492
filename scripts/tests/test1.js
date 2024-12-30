// Define the date range for the image collection.
var startDate = '2019-10-05';  // Start date for filtering Sentinel-1 images.
var endDate = '2019-12-06';    // End date for filtering Sentinel-1 images.

/*
*******************************
* startDate: Sets the start date (October 5, 2019) for filtering Sentinel-1 images.
* endDate: Sets the end date (December 6, 2019) for filtering Sentinel-1 images.
*******************************
*/

// Define the coordinates for the Kosi Basin region.
var kosiBasinCoords = [
    [84.3385787995524, 22.290213141728405], // Coordinates of the Kosi Basin polygon
    [91.2599655183024, 22.15800096320843],
    [90.9633346589274, 26.126933775055694],
    [84.8439498933024, 26.491320646359558],
    [84.3385787995524, 22.290213141728405]  // Closing the polygon by repeating the first coordinate
];

// Create a polygon geometry for the Kosi Basin using the defined coordinates.
var kosiBasin = ee.Geometry.Polygon(kosiBasinCoords);

/*
*******************************
* kosiBasinCoords: Defines the coordinates for the Kosi Basin region as an array of latitude-longitude pairs.
* kosiBasin: Creates a polygon geometry using the specified coordinates to represent the area of interest (Kosi Basin).
*******************************
*/

// Load Sentinel-1 image collection from COPERNICUS/S1_GRD, filtered by region, date, and orbit properties.
var s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin)  // Filter the collection by the Kosi Basin region
    .filterDate(startDate, endDate)  // Filter images within the defined date range
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))  // Filter images with ascending orbit
    .filter(ee.Filter.eq('instrumentMode', 'IW'));  // Filter images using the 'IW' instrument mode

/*
*******************************
* s1Collection: Filters the Sentinel-1 image collection based on the region (kosiBasin),
* date range (startDate to endDate), ascending orbit, and instrument mode ('IW').
*******************************
*/

// Grab the first image from the filtered Sentinel-1 collection.
var s1Image = s1Collection.first();

/*
*******************************
* s1Image: Selects the first image from the filtered Sentinel-1 image collection for analysis.
*******************************
*/

// Add the first Sentinel-1 image to the map with specific visualization parameters.
Map.addLayer(s1Image, {
    min: -25,  // Minimum value for the display (dB)
    max: 0,    // Maximum value for the display (dB)
    bands: 'VV' // Select the 'VV' polarization band for analysis
}, 'Sentinel-1 image');

/*
*******************************
* Map.addLayer: Adds the Sentinel-1 image (selected by 'VV' band) to the map with the specified display range
* and visualization settings for better visibility.
*******************************
*/

// Define the polarization band to use for analysis.
var band = 'VV';

/*
*******************************
* band: Specifies the 'VV' band of Sentinel-1 imagery for further analysis.
*******************************
*/

// Define a reducer to calculate the histogram of values for the selected band.
var histogramReducer = ee.Reducer.histogram(500, 0.1); // 500 buckets, bin width of 0.1

/*
*******************************
* histogramReducer: Defines the histogram reducer to compute the histogram for the selected band ('VV')
* with 500 bins and a bin width of 0.1.
*******************************
*/

// Compute the histogram for the selected band of the first Sentinel-1 image.
var globalHistogram = ee.Dictionary(
    s1Image.select(band).reduceRegion({
        reducer: histogramReducer,  // Apply the histogram reducer
        geometry: s1Image.geometry(),  // Use the geometry of the image for region of interest
        scale: 90,  // Use a scale of 90 meters for pixel resolution
        maxPixels: 1e10  // Allow processing of a large number of pixels
    }).get(band)
);

/*
*******************************
* globalHistogram: Computes the histogram for the 'VV' band of the Sentinel-1 image within the defined region,
* storing the bucket means and counts.
*******************************
*/

// Extract the histogram data: bucket means and counts.
var x = ee.List(globalHistogram.get('bucketMeans'));  // Bucket mean values
var y = ee.List(globalHistogram.get('histogram'));    // Histogram counts

/*
*******************************
* x: Extracts the bucket mean values from the histogram data.
* y: Extracts the histogram counts from the histogram data.
*******************************
*/

// Create a data collection for plotting the histogram.
var dataCol = ee.Array.cat([x, y], 1).toList();

/*
*******************************
* dataCol: Combines the bucket mean values (x) and the histogram counts (y) into a collection for chart plotting.
*******************************
*/

// Define the header information for the chart.
var columnHeader = ee.List([
    [
        {
            label: 'Backscatter',  // Label for the x-axis (backscatter values)
            role: 'domain',  // Defines this as the domain (independent variable)
            type: 'number'  // Data type is 'number'
        },
        {
            label: 'Values',  // Label for the y-axis (frequency of backscatter values)
            role: 'data',  // Defines this as the data (dependent variable)
            type: 'number'  // Data type is 'number'
        }]
]);

/*
*******************************
* columnHeader: Defines the header for the chart, specifying the roles of the data columns (Backscatter and Values).
*******************************
*/

// Combine the header and data into a data table for plotting.
var dataTable = columnHeader.cat(dataCol);

/*
*******************************
* dataTable: Combines the column header and data collection to create a table for charting.
*******************************
*/

// Plot the histogram with an initial chart.
dataTable.evaluate(function(dataTableClient) {
    var chart = ui.Chart(dataTableClient)
        .setChartType('AreaChart')  // Set the chart type to AreaChart
        .setOptions({
            title: band + ' Global Histogram',  // Chart title
            hAxis: {
                title: 'Backscatter [dB]',  // Label for the x-axis
                viewWindow: {
                    min: -35,  // Minimum view window for the x-axis
                    max: 15    // Maximum view window for the x-axis
                }
            },
            vAxis: {
                title: 'Count'  // Label for the y-axis (frequency of backscatter values)
            }
        });
    print(chart);  // Display the chart in the console
});

/*
*******************************
* dataTable.evaluate: Plots the histogram using a chart with customized settings for visualization.
*******************************
*/

// Function to compute Otsu threshold for image classification.
function otsu(histogram) {
    var counts = ee.Array(histogram.get('histogram'));  // Histogram counts
    var means = ee.Array(histogram.get('bucketMeans'));  // Bucket means
    var size = means.length().get([0]);  // Number of buckets
    var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);  // Total count of all values
    var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);  // Weighted sum of means
    var mean = sum.divide(total);  // Mean of all values
    var indices = ee.List.sequence(1, size);  // Sequence of indices for each bucket
    var bss = indices.map(function(i) {
        var aCounts = counts.slice(0, 0, i);  // Slice the counts for the first i buckets
        var aCount = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]);
        var aMeans = means.slice(0, 0, i);  // Slice the means for the first i buckets
        var aMean = aMeans.multiply(aCounts)
            .reduce(ee.Reducer.sum(), [0]).get([0])
            .divide(aCount);  // Mean of the first i buckets
        var bCount = total.subtract(aCount);  // Remaining counts
        var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount);  // Mean of the remaining buckets
        return aCount.multiply(aMean.subtract(mean).pow(2))  // Between-class variance
            .add(bCount.multiply(bMean.subtract(mean).pow(2)));  // Between-class variance
    });
    return means.sort(bss).get([-1]);  // Return the optimal threshold
}

// Apply Otsu thresholding and adjust the threshold manually.
var adjustmentFactor = -2;  // Lower the threshold by 2 dB (can be adjusted)
var globalThreshold = otsu(globalHistogram).add(adjustmentFactor);  // Apply thresholding with adjustment

print('Adjusted global threshold value:', globalThreshold);  // Print the adjusted threshold value

/*
*******************************
* otsu: Computes the Otsu threshold by maximizing the between-class variance in the histogram.
* globalThreshold: Applies the Otsu threshold to the histogram and adjusts it manually by a factor of -2 dB.
*******************************
*/

// Create an empty list for annotation on the histogram chart.
var thresholdCol = ee.List.repeat('', x.length());

// Find the index where the bucket mean equals the adjusted threshold.
var threshIndex = x.indexOf(globalThreshold);
thresholdCol = thresholdCol.set(threshIndex, 'Adjusted Threshold');

// Redefine the column header to include the annotation for the threshold.
columnHeader = ee.List([
    [
        {
            label: 'Backscatter',  // Label for the x-axis
            role: 'domain',  // Role of this column as the domain (independent variable)
            type: 'number'  // Data type is 'number'
        },
        {
            label: 'Values',  // Label for the y-axis
            role: 'data',  // Role of this column as the data (dependent variable)
            type: 'number'  // Data type is 'number'
        },
        {
            label: 'Threshold',  // Label for the annotation column
            role: 'annotation',  // Role of this column as annotation (text)
            type: 'string'  // Data type is 'string'
        }]
]);

/*
*******************************
* thresholdCol: Stores the annotation for the threshold at the computed index.
* columnHeader: Updates the column header to include the annotation for the adjusted threshold.
*******************************
*/

// Loop through the data and add the annotation column with the threshold label.
dataCol = ee.List.sequence(0, x.length().subtract(1)).map(function(i) {
    i = ee.Number(i);
    var row = ee.List(dataCol.get(i));
    return row.add(ee.String(thresholdCol.get(i)));
});

// Combine the updated header and data for plotting.
dataTable = columnHeader.cat(dataCol);

// Plot the updated histogram with the adjusted threshold annotation.
dataTable.evaluate(function(dataTableClient) {
    // Loop through the client-side table and replace empty strings with null
    for (var i = 0; i < dataTableClient.length; i++) {
        if (dataTableClient[i][2] === '') {
            dataTableClient[i][2] = null;
        }
    }
    var chart = ui.Chart(dataTableClient)
        .setChartType('AreaChart')  // Set the chart type to AreaChart
        .setOptions({
            title: band + ' Global Histogram with Adjusted Threshold',  // Chart title
            hAxis: {
                title: 'Backscatter [dB]',  // Label for the x-axis
                viewWindow: {
                    min: -35,  // Minimum view window for the x-axis
                    max: 15    // Maximum view window for the x-axis
                }
            },
            vAxis: {
                title: 'Count'  // Label for the y-axis
            },
            annotations: {
                style: 'line'  // Display annotations as a line
            }
        });
    print(chart);  // Display the updated chart
});

/*
*******************************
* dataTable.evaluate: Recomputes and plots the histogram with the adjusted threshold,
* displaying it as an AreaChart with annotations marking the threshold.
*******************************
*/

// Apply the adjusted threshold to classify water pixels in the image.
var globalWater = s1Image.select(band).lt(globalThreshold);  // Apply thresholding (water identified below threshold)

// Add the classified water image to the map with the adjusted threshold.
Map.addLayer(globalWater.selfMask(), { palette: 'blue' }, 'Water (adjusted threshold)');

/*
*******************************
* globalWater: Classifies the pixels below the threshold as water.
* Map.addLayer: Adds the water mask (where the image values are below the adjusted threshold) to the map.
*******************************
*/
