/***************************************
 * Preprocessing Script for Flood Analysis
 * Author: Vibhanshu Lodhi
 * Description: This script preprocesses raw GEE data (e.g., DEM, LULC, and flood images) using
 * Otsu's thresholding and other steps to generate refined variables that can be used in flood analysis.
 * The processed variables are exported as assets to the GEE folder `ee-vibhanshu`.
 ***************************************/

// Define the Region of Interest (ROI).
var roi = ee.FeatureCollection("projects/ee-vibhanshu/assets/geometry_box_raw"); // Use raw ROI geometry from your folder

/***************************************
 * Step 1: Import Raw Datasets
 ***************************************/
// Import DEM (Digital Elevation Model) from the SRTM dataset
var raw_dem = ee.Image("USGS/SRTMGL1_003");

// Import raw LULC data from the Dynamic World dataset
var raw_lulc = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
    .filterBounds(roi)
    .filterDate('2023-01-01', '2023-12-31') // Filter for a specific year
    .mosaic(); // Combine all images into one

// Import daily precipitation data from the ECMWF ERA5 dataset
var raw_precipitation = ee.ImageCollection("ECMWF/ERA5/DAILY")
    .select('total_precipitation')
    .filterBounds(roi)
    .filterDate('2023-01-01', '2023-12-31'); // Year-long data

/***************************************
 * Step 2: Preprocessing DEM (Clip to ROI)
 ***************************************/
var dem_clipped = raw_dem.clip(roi);

// Export the preprocessed DEM as an asset
Export.image.toAsset({
    image: dem_clipped,
    description: 'DEM_Clipped',
    assetId: 'projects/ee-vibhanshu/assets/dem_clipped',
    region: roi.geometry().bounds(),
    scale: 30,
    maxPixels: 1e13
});

/***************************************
 * Step 3: Preprocessing LULC (Clip and Aggregate Classes)
 ***************************************/
// Aggregate LULC classes by keeping the most frequent class in each pixel
var lulc_processed = raw_lulc.clip(roi);

// Export the preprocessed LULC as an asset
Export.image.toAsset({
    image: lulc_processed,
    description: 'LULC_Processed',
    assetId: 'projects/ee-vibhanshu/assets/lulc_processed',
    region: roi.geometry().bounds(),
    scale: 10,
    maxPixels: 1e13
});

/***************************************
 * Step 4: Flood Image Preprocessing using Otsu's Method
 ***************************************/
// Function to calculate Otsu's threshold
var otsuThreshold = function(histogram) {
    var counts = ee.Array(histogram.histogram());
    var means = ee.Array(histogram.bucketMeans());
    var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);
    var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);
    var mean = sum.divide(total);

    var size = counts.length().get([0]);
    var indices = ee.List.sequence(1, size);

    var betweenClassVariance = indices.map(function(i) {
        var aCounts = counts.slice(0, 0, i);
        var aTotal = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]);
        var aSum = means.slice(0, 0, i).multiply(aCounts)
            .reduce(ee.Reducer.sum(), [0])
            .get([0]);
        var aMean = aSum.divide(aTotal);
        var bTotal = total.subtract(aTotal);
        var bSum = sum.subtract(aSum);
        var bMean = bSum.divide(bTotal);
        return aTotal.multiply(bTotal).multiply(aMean.subtract(bMean).pow(2));
    });

    return means.sort(betweenClassVariance).get([-1]);
};

// Example flood image (replace with actual dataset)
var raw_flood_image = ee.ImageCollection("COPERNICUS/S2")
    .filterBounds(roi)
    .filterDate('2023-08-01', '2023-08-15') // Example date range for flood event
    .median()
    .clip(roi);

// Calculate NDWI (Normalized Difference Water Index) for flood detection
var ndwi = raw_flood_image.normalizedDifference(['B3', 'B8']).rename('NDWI');

// Compute histogram and apply Otsu's threshold
var histogram = ndwi.reduceRegion({
    reducer: ee.Reducer.histogram(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e13
}).get('NDWI');

var threshold = otsuThreshold(histogram);
var flood_mask = ndwi.gt(ee.Image.constant(threshold)).rename('Flood_Mask');

// Export the flood mask as an asset
Export.image.toAsset({
    image: flood_mask,
    description: 'Flood_Mask',
    assetId: 'projects/ee-vibhanshu/assets/flood_mask',
    region: roi.geometry().bounds(),
    scale: 30,
    maxPixels: 1e13
});

/***************************************
 * Step 5: Processed Precipitation (Temporal Aggregation)
 ***************************************/
// Aggregate precipitation data (e.g., total precipitation over the year)
var precipitation_total = raw_precipitation.sum().clip(roi);

// Export the aggregated precipitation data as an asset
Export.image.toAsset({
    image: precipitation_total,
    description: 'Precipitation_Total',
    assetId: 'projects/ee-vibhanshu/assets/precipitation_total',
    region: roi.geometry().bounds(),
    scale: 30,
    maxPixels: 1e13
});

/***************************************
 * Step 6: Compute Terrain Position Index (TPI)
 ***************************************/
// Function to compute TPI
var computeTPI = function(dem, radius) {
    var kernel = ee.Kernel.circle({
        radius: radius,
        units: 'meters',
        normalize: true
    });
    var mean = dem.reduceNeighborhood(ee.Reducer.mean(), kernel);
    return dem.subtract(mean).rename('TPI');
};

var tpi_large = computeTPI(dem_clipped, 5000); // 5 km radius
var tpi_small = computeTPI(dem_clipped, 500);  // 500 m radius

// Export the TPI layers as assets
Export.image.toAsset({
    image: tpi_large,
    description: 'TPI_Large',
    assetId: 'projects/ee-vibhanshu/assets/tpi_large',
    region: roi.geometry().bounds(),
    scale: 30,
    maxPixels: 1e13
});

Export.image.toAsset({
    image: tpi_small,
    description: 'TPI_Small',
    assetId: 'projects/ee-vibhanshu/assets/tpi_small',
    region: roi.geometry().bounds(),
    scale: 30,
    maxPixels: 1e13
});
