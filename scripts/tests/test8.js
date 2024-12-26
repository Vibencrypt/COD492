var roi = geometry


Map.centerObject(roi, 10);  // Adjust zoom level as needed

// Add the polygon to the map with a specific style
Map.addLayer(roi, {color: 'blue'}, 'Drawn Polygon');

// Load the Sentinel-1 image collection for VV polarization
var sentinel1 = ee.ImageCollection('COPERNICUS/S1_GRD')
                  .filterBounds(roi)
                  .filterDate('2023-01-01', '2023-12-31')
                  .filter(ee.Filter.eq('instrumentMode', 'IW'))  // Interferometric Wide Swath mode
                  .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));  // Optional: Choose orbit direction

// Function to calculate overlap area
var calculateOverlap = function(image) {
  var intersection = image.geometry().intersection(roi, ee.ErrorMargin(1));
  var overlapArea = intersection.area(1);  // Calculate area in square meters
  return image.set('overlap', overlapArea);  // Add overlap as a property
};

// Map the overlap calculation across the collection
var imagesWithOverlap = sentinel1.map(calculateOverlap);

// Sort images by the overlap property in descending order
var sortedImages = imagesWithOverlap.sort('overlap', false);

// Get the image with the maximum overlap
var bestImage = ee.Image(sortedImages.first());

// Display the best image on the map
Map.addLayer(bestImage.clip(roi), {min: -30, max: 0}, 'Best Overlap Sentinel-1 VV');
print('Best Overlap Image:', bestImage);

// Apply speckle filtering (optional but improves clarity)
var speckleFiltered = bestImage.focalMedian(30, 'circle', 'meters');

// Add filtered image to the map
Map.addLayer(speckleFiltered.clip(roi), {min: -30, max: 0}, 'Speckle Filtered Image');

// Function to calculate cumulative sum
var cumulativeSum = function(array) {
  var cumulative = ee.List([]);
  var sum = 0;
  for (var i = 0; i < array.length().getInfo(); i++) {
    sum += array.get([i]).getInfo();
    cumulative = cumulative.add(sum);
  }
  return ee.Array(cumulative);
};

// Function to calculate Otsu's threshold
var otsuThresholding = function(image, roi) {
  var histogram = image.reduceRegion({
    reducer: ee.Reducer.histogram(),
    geometry: roi,
    scale: 10,
    maxPixels: 1e9,
    bestEffort: true
  });
  
  var hist = ee.Array(histogram.get('VV'));  // Adjust based on VV/VH band
  var counts = hist.slice(1, 1);  // Pixel counts
  var bins = hist.slice(1, 0);    // Bins (dB values)

  // Compute cumulative sum for counts
  var cumulativeCounts = cumulativeSum(counts.toList()).toArray();
  
  // Weighted means for background (B) and foreground (F)
  var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);
  var sum = bins.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);
  var meanTotal = sum.divide(total);

  var meanB = cumulativeCounts.divide(total);
  var meanF = meanTotal.subtract(meanB);

  // Between-class variance
  var betweenClassVariance = meanB.multiply(meanF).multiply(meanB.subtract(meanTotal).pow(2));
  var thresholdIndex = betweenClassVariance.argmax();
  
  return bins.get(thresholdIndex);
};

// Apply Otsu's threshold to the image
var threshold = otsuThresholding(speckleFiltered, roi);
var waterMask = speckleFiltered.lt(threshold);

// Add water mask to the map
Map.addLayer(waterMask.updateMask(waterMask), {palette: ['blue']}, 'Water Mask');


