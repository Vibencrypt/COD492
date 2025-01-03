// --- Load and Display Flood Areas ---
// The following lines display different flood areas with respective color palettes.
Map.addLayer(image3.selfMask(), {
  palette: '#00e1d8'
}, 'Flood areas 3'); // Flood areas for image3, highlighted in cyan.

Map.addLayer(aug13.selfMask(), {
  palette: '#00008B'
}, 'Flood areas 13'); // Flood areas for August 13, highlighted in navy blue.

Map.addLayer(aug25.selfMask(), {
  palette: '#00e1d8'
}, 'Flood areas 25'); // Flood areas for August 25, highlighted in cyan.

// --- Define Date Range ---
// Setting the temporal bounds for the analysis.
var START = ee.Date('2023-08-03'); // Starting date for analysis (August 3, 2023).
var END = START.advance(20, 'day'); // Ending date, 20 days after START (August 23, 2023).

// --- Display Table Layer ---
// Display the region of interest (ROI) defined by the "table" variable.
Map.addLayer(table, {}, 'table'); // Adds the ROI boundaries to the map.

// --- Load and Filter Precipitation Data ---
// Load daily aggregated precipitation and runoff data from ECMWF ERA5 dataset.
var agg = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
    .select('total_precipitation_sum', 'runoff_sum') // Selects the required bands.
    .filterBounds(table) // Filters data to the region defined by "table".
    .filterDate(START, END); // Filters data within the date range.

// Function to extract precipitation-related bands.
var extractPrecipitation = function(image) {
  return image.select('total_precipitation_sum', 'runoff_sum'); // Extracts precipitation and runoff bands.
};

// --- Prepare Precipitation Collection ---
// Applies the extraction function, converts data to bands, and clips to the ROI.
var precipCollection = agg.map(extractPrecipitation).toBands().clip(table);

// --- Add Elevation and Terrain Data ---
// Incorporate additional topographic data to enhance the analysis.
var elev = dem.clip(table); // Elevation data clipped to ROI.
var slope = ee.Terrain.slope(dem).clip(table); // Slope data derived from DEM and clipped to ROI.

// Adding elevation, slope, and terrain indices to the collection.
precipCollection = precipCollection.addBands(elev, ['elevation']);
precipCollection = precipCollection.addBands(slope, ['slope']);
precipCollection = precipCollection.addBands(tpi_large, ['elevation'], false);
precipCollection = precipCollection.addBands(tpi_small, ['elevation'], false);

// --- Add Land Use/Land Cover (LULC) Data ---
// Incorporates LULC data into the collection.
lulc_computed = lulc_computed.select(['label'], ['lulc']); // Renames the label band to "lulc".
precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false);

// --- Add Constant Band ---
// Adds a constant band (e.g., aug13) to the collection.
precipCollection = precipCollection.addBands(aug13, ['constant']);

// --- Generate Random Points ---
// Generate random points within the ROI for sampling purposes.
var randomPoints = ee.FeatureCollection.randomPoints(table, 10000); // Generates 10,000 random points.

// Assign values from the "constant" band to each random point.
randomPoints = randomPoints.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(), // Gets the first pixel value.
    geometry: feature.geometry(), // Uses the geometry of the feature.
    scale: 30 // Scale for the operation.
  }).get('constant');

  return feature.set('label', value); // Sets the "label" property with the extracted value.
});

// --- Generate Training Data ---
// Sample precipitation collection at the random points to create training data.
var training = precipCollection.sampleRegions({
  collection: randomPoints, // Uses random points for sampling.
  properties: ['label'], // Includes the "label" property.
  scale: 30 // Sampling scale.
});

// Map through training data and assign the "constant" value to each feature.
training = training.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(), // Gets the first pixel value.
    geometry: feature.geometry(), // Uses the geometry of the feature.
    scale: 30 // Scale for the operation.
  }).get('constant');

  return feature.set('label', value); // Sets the "label" property with the extracted value.
});

// --- Train a Classifier ---
// Initialize and train a random forest classifier using the training data.
var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 100 // Number of trees in the forest.
});

var trained = classifier.train(training, 'constant', precipCollection.bandNames()); // Train the classifier.

// Evaluate the classifier performance using a confusion matrix.
var confusionMatrix = trained.confusionMatrix();
print('Confusion Matrix:', confusionMatrix); // Outputs the confusion matrix.

// --- Classify the Image ---
// Apply the trained classifier to the precipitation collection.
var classified = precipCollection.select(precipCollection.bandNames()).classify(trained);

// --- Display Results ---
// Visualize the classified results and precipitation collection on the map.
Map.addLayer(classified.selfMask(), { palette: 'red' }, "classified"); // Classified areas in red.
Map.addLayer(classified.selfMask(), { palette: 'royalblue' }, 'Flood areas'); // Flood areas in royal blue.
Map.addLayer(precipCollection.select('constant'), {}, "precipCollection"); // Displays the precipitation collection.
