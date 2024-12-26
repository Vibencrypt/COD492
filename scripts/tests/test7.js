// Define region of interest (ROI) and initialize datasets
var table = ee.FeatureCollection("projects/ee-atharv/assets/COL865/geometry_box_export");
var dem = ee.Image("USGS/SRTMGL1_003");  // Elevation data
var imageCollection = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR");  // Historical precipitation data
var lulc_computed = ee.Image("projects/ee-atharv/assets/COL865/lulc_dynamic_world");  // Land cover data

// Load historical flood images for training
var historicalFloodImages = [
    ee.Image("projects/ee-atharv/assets/flood_image_roi_export_1Aug_edition2"),
    ee.Image("projects/ee-atharv/assets/flood_image_roi_export_13aug"),
    ee.Image("projects/ee-atharv/assets/flood_image_roi_export_25Aug")
];

// Set forecast dates (next 7 days)
var forecastStart = ee.Date('2023-08-03');  // Adjust based on current or recent dates
var forecastEnd = forecastStart.advance(7, 'day');
var forecastedPrecipitation = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
    .select('total_precipitation_sum')
    .filterBounds(table)
    .filterDate(forecastStart, forecastEnd);

// Set historical data range
var historicalStart = ee.Date('2022-07-01');  // Adjust as needed
var historicalEnd = historicalStart.advance(1, 'year');
var historicalData = imageCollection
    .select(['total_precipitation_sum', 'runoff_sum'])
    .filterBounds(table)
    .filterDate(historicalStart, historicalEnd);

// Prepare historical precipitation data
var historicalPrecipCollection = historicalData.map(function(img) {
    return img.select(['total_precipitation_sum', 'runoff_sum']);
}).toBands().clip(table);

// Add terrain data (elevation and slope)
var elev = dem.clip(table);
var slope = ee.Terrain.slope(dem).clip(table);
historicalPrecipCollection = historicalPrecipCollection.addBands(elev.rename('elevation'));
historicalPrecipCollection = historicalPrecipCollection.addBands(slope.rename('slope'));

// Add land cover data
lulc_computed = lulc_computed.select(['label']).rename(['lulc']);
historicalPrecipCollection = historicalPrecipCollection.addBands(lulc_computed);

// Define labels using historical flood images (flood presence indicator)
var floodLabelImage = ee.ImageCollection(historicalFloodImages).max().rename('flood_label');

// Sample points
var randomPoints = ee.FeatureCollection.randomPoints(table, 10000);
randomPoints = randomPoints.map(function(feature) {
  var value = floodLabelImage.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: feature.geometry(),
    scale: 30
  }).get('flood_label');

  return feature.set('label', ee.Algorithms.If(value, value, 0));  // Set label, defaulting to 0 if no data
});

// Prepare training dataset
var training = historicalPrecipCollection.sampleRegions({
  collection: randomPoints,
  properties: ['label'],
  scale: 30
});

// Train classifier
var classifier = ee.Classifier.libsvm({
  kernelType: 'RBF',
  gamma: 0.5,
  cost: 10
});
var trained = classifier.train(training, 'label', historicalPrecipCollection.bandNames());

// Prepare forecasted precipitation for prediction
var forecastPrecipCollection = forecastedPrecipitation.toBands().clip(table)
    .addBands(elev.rename('elevation'))
    .addBands(slope.rename('slope'))
    .addBands(lulc_computed);

// Apply the model to forecasted data to predict flood-prone zones
var floodPrediction = forecastPrecipCollection.classify(trained);

// Visualize predicted flood-prone areas
Map.addLayer(floodPrediction.selfMask(), {palette: 'blue'}, 'Predicted Flood-Prone Zones for Next 7 Days');
