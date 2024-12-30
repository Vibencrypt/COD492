// --- Load and Display Flood Areas ---
Map.addLayer(image3.selfMask(), { palette: '#00e1d8' }, 'Flood areas 3');
Map.addLayer(aug13.selfMask(), { palette: '#00008B' }, 'Flood areas 13');
Map.addLayer(aug25.selfMask(), { palette: '#00e1d8' }, 'Flood areas 25');

// --- Define Date Range ---
var START = ee.Date('2023-08-03'); // Starting date for analysis
var END = START.advance(20, 'day'); // Ending date (20 days after START)

// --- Display Table Layer ---
Map.addLayer(table, {}, 'table'); // Display the region of interest (ROI) defined by `table`

// --- Load and Filter Precipitation Data ---
var agg = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR") // Load ECMWF dataset
    .select(['total_precipitation_sum', 'runoff_sum']) // Select required bands
    .filterBounds(table) // Filter for the ROI
    .filterDate(START, END); // Filter for the defined date range

// Function to extract precipitation-related bands
var extractPrecipitation = function(image) {
  return image.select(['total_precipitation_sum', 'runoff_sum']); // Extract precipitation and runoff bands
};

// Map the function to the ImageCollection and clip to the ROI
var precipCollection = agg.map(extractPrecipitation).toBands().clip(table);

// --- Add Elevation and Terrain Data ---
var elev = dem.clip(table); // Clip DEM data to the ROI for elevation
var slope = ee.Terrain.slope(dem).clip(table); // Calculate and clip slope data

// Add elevation, slope, and other topographic indices (TPI) to the collection
precipCollection = precipCollection
    .addBands(elev, ['elevation'])
    .addBands(slope, ['slope'])
    .addBands(tpi_large, ['elevation'], false)
    .addBands(tpi_small, ['elevation'], false);

// Add land use/land cover (LULC) data to the collection
lulc_computed = lulc_computed.select(['label'], ['lulc']); // Rename 'label' band to 'lulc'
precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false);

// --- Random Points for Sampling ---
var randomPoints = ee.FeatureCollection.randomPoints(table, 10000); // Generate random points within ROI

// Map through points and assign the value of the 'constant' band to each point
randomPoints = randomPoints.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(), // Extract the first pixel value
    geometry: feature.geometry(),
    scale: 30 // Scale of analysis (30m)
  }).get('constant');
  return feature.set('label', value); // Set the label property to the constant value
});

// --- Generate Training Data ---
var training = precipCollection.sampleRegions({
  collection: randomPoints, // Use the random points for sampling
  properties: ['label'], // Include the 'label' property
  scale: 30 // Sampling scale
});

// Map through training data and assign the 'constant' value to each feature
training = training.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: feature.geometry(),
    scale: 30
  }).get('constant');
  return feature.set('label', value);
});

// --- Train a Classifier ---
var classifier = ee.Classifier.libsvm({
  kernelType: 'RBF', // Radial Basis Function kernel
  gamma: 0.5, // Kernel coefficient
  cost: 10 // Regularization parameter
});

// Train the classifier using training data
var trained = classifier.train(training, 'constant', precipCollection.bandNames());

// --- Evaluate Classifier Performance ---
var confusionMatrix = trained.confusionMatrix(); // Generate confusion matrix
print('Confusion Matrix:', confusionMatrix); // Print confusion matrix to evaluate accuracy

// --- Classify Image ---
var classified = precipCollection.select(precipCollection.bandNames()).classify(trained); // Classify the data

// --- Display Results ---
Map.addLayer(classified.selfMask(), { palette: 'red' }, "classified"); // Add classified result to the map
Map.addLayer(classified.selfMask(), { palette: 'royalblue' }, 'Flood areas'); // Add another visualization for flood areas
Map.addLayer(precipCollection.select('constant'), {}, "precipCollection"); // Display the collection
