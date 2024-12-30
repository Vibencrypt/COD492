// -----------------------------------
// Flood Prediction Model - River Kosi Basin
// Author: Vibhanshu Lodhi
// Purpose: This script predicts flood-prone areas in the Kosi River basin
// by integrating multiple datasets such as precipitation, runoff, elevation,
// slope, LULC (Land Use Land Cover), and generating labels for flood predictions.
// It trains a Random Forest classifier using Earth Engine's capabilities.
// -----------------------------------

// Define the date range for analysis.
// START: Start date of interest.
// END: End date of interest (20 days after START).
var START = ee.Date('2023-08-03');
var END = START.advance(20, 'day');

// Load the precipitation and runoff dataset.
// ECMWF/ERA5_LAND/DAILY_AGGR provides daily aggregated data.
// Filter the data by the region of interest (table) and the date range.
var agg = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
    .select(['total_precipitation_sum', 'runoff_sum'])
    .filterBounds(table)
    .filterDate(START, END);

// Function to extract specific bands for precipitation and runoff.
var extractPrecipitation = function(image) {
  return image.select('total_precipitation_sum', 'runoff_sum');
};

// Map the extraction function over the image collection,
// convert the collection into a multi-band image, and clip to the study region.
var precipCollection = agg.map(extractPrecipitation).toBands().clip(table);

// Load and process elevation data.
// Clip the elevation data to the region of interest.
var elev = dem.clip(table);

// Calculate slope from the elevation data and clip to the region of interest.
var slope = ee.Terrain.slope(dem).clip(table);

// Add elevation and slope as additional bands to the precipitation collection.
precipCollection = precipCollection.addBands(elev, ['elevation']);
precipCollection = precipCollection.addBands(slope, ['slope']);

// Add TPI (Topographic Position Index) data as bands, without overwriting existing band names.
precipCollection = precipCollection.addBands(tpi_large, ['elevation'], false);
precipCollection = precipCollection.addBands(tpi_small, ['elevation'], false);

// Process Land Use Land Cover (LULC) data.
// Select the 'label' band and rename it to 'lulc'.
lulc_computed = lulc_computed.select(['label'], ['lulc']);

// Add LULC as a band to the precipitation collection.
precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false);

// Print the band names for verification.
var bands = precipCollection.bandNames();

// Add constant flood label (e.g., flood presence on a specific date).
// Here, 'aug13' represents flood-prone areas for August 13.
precipCollection = precipCollection.addBands(aug13, ['constant']);

// Generate random points within the study region to sample the data.
var randomPoints = ee.FeatureCollection.randomPoints(table, 10000);

// Map over the random points to add the 'constant' flood label as a property.
randomPoints = randomPoints.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(), // Get the first value within the point.
    geometry: ee.FeatureCollection(feature),
    scale: 30 // Resolution of 30 meters.
  }).get('constant');

  return feature.set('label', value); // Add the label property.
});

// Sample the precipitation collection at the random points.
// The 'label' property is used as the target class for training.
var training = precipCollection.sampleRegions({
  collection: randomPoints,
  properties: ['label'],
  scale: 30
});

// Train a Random Forest classifier with the training data.
var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 2000 // Use 2000 trees for better accuracy.
});
var trained = classifier.train(training, 'constant', bands);

// Compute and print the confusion matrix for evaluation.
var confusionMatrix = trained.confusionMatrix();
print('Confusion Matrix:', confusionMatrix);

// Classify the entire precipitation collection using the trained classifier.
var classified = precipCollection.select(bands).classify(trained);

// Visualize the classified flood-prone areas on the map.
Map.addLayer(classified.selfMask(), {
  palette: 'royalblue'
}, 'Flood areas');

// Center the map to the study area for better visualization.
Map.centerObject(table);

// -----------------------------------
// End of Script
// -----------------------------------
