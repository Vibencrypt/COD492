// Define the date range for pre-flood and post-flood images.
// Pre-flood period: From September 1, 2019, to September 30, 2019
// Post-flood period: From October 5, 2019, to December 6, 2019
var preFloodStartDate = '2019-09-01';
var preFloodEndDate = '2019-09-30'; // Pre-flood period
var postFloodStartDate = '2019-10-05';
var postFloodEndDate = '2019-12-06'; // Post-flood period

// Define the coordinates for the Kosi Basin region. These coordinates represent
// the four corners of the polygon area covering the Kosi Basin region in India.
var kosiBasinCoords = [
  [84.3385787995524, 22.290213141728405],
  [91.2599655183024, 22.15800096320843],
  [90.9633346589274, 26.126933775055694],
  [84.8439498933024, 26.491320646359558],
  [84.3385787995524, 22.290213141728405]  // Closing the polygon by repeating the first coordinate
];

// Create a polygon geometry object representing the Kosi Basin region.
// This geometry will be used to filter the Sentinel-1 image collection later.
var kosiBasin = ee.Geometry.Polygon(kosiBasinCoords);

// Load Sentinel-1 image collection for both the pre-flood and post-flood periods.
// Sentinel-1 is a radar satellite that captures ground surface data, useful for flood detection.
var s1PreFlood = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin) // Filter the images to include only those that intersect the Kosi Basin region.
    .filterDate(preFloodStartDate, preFloodEndDate) // Filter images from the pre-flood period.
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING')) // Consider only ascending pass images (from west to east).
    .filter(ee.Filter.eq('instrumentMode', 'IW')) // Filter for Interferometric Wide (IW) mode images.
    .first(); // Get the first image in the collection.

var s1PostFlood = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin) // Filter the images to include only those within the Kosi Basin.
    .filterDate(postFloodStartDate, postFloodEndDate) // Filter images from the post-flood period.
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING')) // Consider ascending pass images.
    .filter(ee.Filter.eq('instrumentMode', 'IW')) // Filter for Interferometric Wide (IW) mode images.
    .first(); // Get the first image in the collection.

// Display the pre-flood and post-flood images on the map, using the 'VV' (Vertical-Vertical) polarization band.
// The color range is set to [-25, 0], which corresponds to the dynamic range of the radar data.
Map.addLayer(s1PreFlood, {min: -25, max: 0, bands: 'VV'}, 'Pre-Flood Sentinel-1');
Map.addLayer(s1PostFlood, {min: -25, max: 0, bands: 'VV'}, 'Post-Flood Sentinel-1');

// Define a variable to specify the radar band for water detection.
// The 'VV' band (Vertical-Vertical polarization) is typically used for water surface analysis.
var band = 'VV';

// Define the Otsu thresholding function to automatically calculate an optimal threshold for water detection.
// This method works by minimizing the within-class variance, which helps in distinguishing between water and non-water areas.
function otsu(histogram) {
  var counts = ee.Array(histogram.get('histogram')); // Get the histogram counts.
  var means = ee.Array(histogram.get('bucketMeans')); // Get the bucket means of the histogram.
  var size = means.length().get([0]); // Get the number of histogram buckets.
  var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]); // Calculate the total number of pixels.
  var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]); // Calculate the sum of means weighted by pixel counts.
  var mean = sum.divide(total); // Compute the mean of the entire histogram.

  // Compute the between-class variance for each possible threshold.
  var indices = ee.List.sequence(1, size);
  var bss = indices.map(function(i) {
    var aCounts = counts.slice(0, 0, i); // Counts for class A (pixels below threshold).
    var aCount = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]); // Total count for class A.
    var aMeans = means.slice(0, 0, i); // Means for class A.
    var aMean = aMeans.multiply(aCounts).reduce(ee.Reducer.sum(), [0]).get([0]).divide(aCount); // Mean of class A.
    var bCount = total.subtract(aCount); // Count for class B (pixels above threshold).
    var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount); // Mean of class B.
    return aCount.multiply(aMean.subtract(mean).pow(2))
        .add(bCount.multiply(bMean.subtract(mean).pow(2))); // Calculate between-class variance.
  });

  // Return the threshold corresponding to the maximum between-class variance.
  return means.sort(bss).get([-1]);
}

// Compute histograms for both the pre-flood and post-flood images.
// Histograms are calculated over the selected 'VV' band, within the Kosi Basin region.
// The histogram is reduced to 500 buckets, with a bucket size of 0.1 for more precise calculations.
var preFloodHistogram = ee.Dictionary(s1PreFlood.select(band).reduceRegion({
  reducer: ee.Reducer.histogram(500, 0.1),
  geometry: kosiBasin,
  scale: 90,
  maxPixels: 1e10
}).get(band));

var postFloodHistogram = ee.Dictionary(s1PostFlood.select(band).reduceRegion({
  reducer: ee.Reducer.histogram(500, 0.1),
  geometry: kosiBasin,
  scale: 90,
  maxPixels: 1e10
}).get(band));

// Compute the Otsu threshold for both pre-flood and post-flood images using the defined thresholding function.
var preFloodThreshold = otsu(preFloodHistogram); // Threshold for pre-flood image.
var postFloodThreshold = otsu(postFloodHistogram); // Threshold for post-flood image.

// Apply the calculated Otsu threshold to both pre-flood and post-flood images.
// This step segments the images into water (pixels below threshold) and non-water (pixels above threshold).
var preFloodWater = s1PreFlood.select(band).lt(preFloodThreshold); // Water in pre-flood image.
var postFloodWater = s1PostFlood.select(band).lt(postFloodThreshold); // Water in post-flood image.

// Remove permanent water bodies by excluding water detected in the pre-flood image.
// Permanent water bodies are assumed to be water areas in both pre-flood and post-flood images.
var floodExtent = postFloodWater.and(preFloodWater.not()); // Detect flood extent (change in water coverage).

// Mask the non-water pixels, keeping only flood-affected areas.
var floodMasked = floodExtent.selfMask(); // Apply mask to keep only the flooded regions.

// Add the flood extent layer to the map with a blue color palette to visualize the detected flooded areas.
Map.addLayer(floodMasked, {palette: 'blue'}, 'Detected Flood Extent');

// Print the calculated thresholds for pre-flood and post-flood images to the console for reference.
print('Pre-flood threshold: ', preFloodThreshold);
print('Post-flood threshold: ', postFloodThreshold);
