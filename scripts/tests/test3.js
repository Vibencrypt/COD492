// Define the date range for pre-flood and post-flood images.
var preFloodStartDate = '2019-09-01';
var preFloodEndDate = '2019-09-30'; // Pre-flood period
var postFloodStartDate = '2019-10-05';
var postFloodEndDate = '2019-12-06'; // Post-flood period

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

// Load Sentinel-1 image collection for pre-flood and post-flood periods.
var s1PreFlood = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin)
    .filterDate(preFloodStartDate, preFloodEndDate)
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .first(); // Get the first pre-flood image.

var s1PostFlood = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(kosiBasin)
    .filterDate(postFloodStartDate, postFloodEndDate)
    .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .first(); // Get the first post-flood image.

// Display the pre- and post-flood images.
Map.addLayer(s1PreFlood, {min: -25, max: 0, bands: 'VV'}, 'Pre-Flood Sentinel-1');
Map.addLayer(s1PostFlood, {min: -25, max: 0, bands: 'VV'}, 'Post-Flood Sentinel-1');

// Define a band to use for water detection.
var band = 'VV';

// Define Otsu thresholding function.
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
    var aMean = aMeans.multiply(aCounts).reduce(ee.Reducer.sum(), [0]).get([0]).divide(aCount);
    var bCount = total.subtract(aCount);
    var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount);
    return aCount.multiply(aMean.subtract(mean).pow(2)).add(bCount.multiply(bMean.subtract(mean).pow(2)));
  });
  return means.sort(bss).get([-1]);
}

// Calculate Otsu thresholds for pre-flood and post-flood images.
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

// Compute Otsu threshold for both periods.
var preFloodThreshold = otsu(preFloodHistogram);
var postFloodThreshold = otsu(postFloodHistogram);

// Apply thresholds to detect water for pre-flood and post-flood images.
var preFloodWater = s1PreFlood.select(band).lt(preFloodThreshold);
var postFloodWater = s1PostFlood.select(band).lt(postFloodThreshold);

// Remove permanent water bodies (water detected in pre-flood image).
var floodExtent = postFloodWater.and(preFloodWater.not());

// Mask the non-water pixels.
var floodMasked = floodExtent.selfMask();

// Add flood extent layer to the map.
Map.addLayer(floodMasked, {palette: 'blue'}, 'Detected Flood Extent');

// Display pre- and post-flood thresholds.
print('Pre-flood threshold: ', preFloodThreshold);
print('Post-flood threshold: ', postFloodThreshold);
