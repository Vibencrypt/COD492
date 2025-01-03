// This script performs comprehensive flood analysis by combining flood imagery, precipitation data,
// elevation and terrain features, and land use/land cover (LULC) information. It generates training data,
// trains a classifier, evaluates its performance, and visualizes results on a map.

// --- Display Flood Areas ---
// Add flood imagery layers to visualize the extent of flooding on different dates.
// These layers help in identifying changes in flood coverage over time.
Map.addLayer(image3.selfMask(), { palette: '#00e1d8' }, 'Flood areas 3'); // Flood extent from Image3 (updated version)
Map.addLayer(aug13.selfMask(), { palette: '#00008B' }, 'Flood areas 13'); // Flood extent for August 13
Map.addLayer(aug25.selfMask(), { palette: '#00e1d8' }, 'Flood areas 25'); // Flood extent for August 25

// --- Define Date Range ---
// Specify the analysis period by defining a start date and an end date.
// The analysis focuses on a 20-day window starting from August 3, 2023.
var START = ee.Date('2023-08-03'); // Analysis start date
var END = START.advance(20, 'day'); // Analysis end date (20 days later)

// --- Display Region of Interest (ROI) ---
// Visualize the region of interest (ROI) defined by the `table` variable.
// This helps in ensuring that the analysis is confined to the specified geographical area.
Map.addLayer(table, {}, 'table'); // Add ROI to the map

// --- Load and Filter Precipitation Data ---
// Load daily precipitation and runoff data from the ECMWF ERA5-LAND dataset.
// Filter the dataset by the defined date range and the ROI.
var agg = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR") // Historical weather data
    .select(['total_precipitation_sum', 'runoff_sum']) // Use only precipitation and runoff bands
    .filterBounds(table) // Restrict data to the ROI
    .filterDate(START, END); // Limit data to the analysis period

// Extract relevant precipitation bands and organize them as a multi-band image.
// Clip the data to the ROI to focus only on the target region.
var precipCollection = agg.map(function(image) {
  return image.select(['total_precipitation_sum', 'runoff_sum']); // Extract desired bands
}).toBands().clip(table); // Clip to ROI

// --- Add Elevation and Terrain Data ---
// Incorporate elevation data and terrain derivatives like slope and topographic indices (TPI).
// These features are essential for understanding the influence of terrain on flooding.
var elev = dem.clip(table); // Elevation data clipped to ROI
var slope = ee.Terrain.slope(dem).clip(table); // Slope data derived from elevation

// Add these terrain features as additional bands to the precipitation collection.
precipCollection = precipCollection
    .addBands(elev, ['elevation']) // Add elevation band
    .addBands(slope, ['slope']) // Add slope band
    .addBands(tpi_large, ['elevation'], false) // Add large-scale TPI
    .addBands(tpi_small, ['elevation'], false); // Add small-scale TPI

// Add LULC data to the collection to incorporate land cover information.
// This helps in understanding the relationship between land types and flooding.
lulc_computed = lulc_computed.select(['label'], ['lulc']); // Rename 'label' band to 'lulc'
precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false); // Add LULC band

// --- Generate Random Sampling Points ---
// Create random points within the ROI to use for training data generation.
// These points allow for unbiased sampling of features across the region.
var randomPoints = ee.FeatureCollection.randomPoints(table, 10000); // Generate 10,000 random points

// Assign values from the precipitation collection to the random points.
// Each point is annotated with the value of the 'constant' band, representing flood presence.
randomPoints = randomPoints.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(), // Extract the first available pixel value
    geometry: feature.geometry(), // Use the geometry of the point
    scale: 30 // Set analysis scale to 30 meters
  }).get('constant'); // Retrieve the 'constant' value
  return feature.set('label', value); // Set the label property to the retrieved value
});

// --- Generate Training Data ---
// Sample the regions using the random points and extract features from the precipitation collection.
// This creates a labeled dataset to train the classifier.
var training = precipCollection.sampleRegions({
  collection: randomPoints, // Use random points as sampling locations
  properties: ['label'], // Include the 'label' property as the target variable
  scale: 30 // Sampling resolution (30 meters)
});

// Ensure that each training feature has a label value by explicitly mapping through the features.
training = training.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: feature.geometry(),
    scale: 30
  }).get('constant');
  return feature.set('label', value); // Assign the label property
});

// --- Train a Classifier ---
// Define and train a Support Vector Machine (SVM) classifier using the training data.
// The classifier learns to predict flood presence based on the input features.
var classifier = ee.Classifier.libsvm({
  kernelType: 'RBF', // Use Radial Basis Function kernel for non-linear classification
  gamma: 0.5, // Kernel coefficient
  cost: 10 // Regularization parameter to prevent overfitting
});
var trained = classifier.train(training, 'constant', precipCollection.bandNames());

// --- Evaluate Classifier Performance ---
// Compute the confusion matrix to evaluate the accuracy of the trained classifier.
// The confusion matrix provides insights into the classifier's prediction performance.
var confusionMatrix = trained.confusionMatrix();
print('Confusion Matrix:', confusionMatrix); // Display the confusion matrix

// --- Classify Data ---
// Apply the trained classifier to the precipitation collection to classify flood presence.
// The output is a classified image where each pixel is labeled based on the classifier's prediction.
var classified = precipCollection.select(precipCollection.bandNames()).classify(trained);

// --- Display Results ---
// Visualize the classification results on the map.
// Use different color palettes to distinguish between classified areas and flood zones.
Map.addLayer(classified.selfMask(), { palette: 'red' }, "classified"); // Classified flood areas
Map.addLayer(classified.selfMask(), { palette: 'royalblue' }, 'Flood areas'); // Another visualization for flood areas
Map.addLayer(precipCollection.select('constant'), {}, "precipCollection"); // Display raw precipitation collection
