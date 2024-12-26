// Map.addLayer(image3.selfMask(), {
//     palette: '#00e1d8'
// }, 'Flood areas 3')

// Map.addLayer(aug13.selfMask(), {
//     palette: '#00008B'
// }, 'Flood areas 13')

// Map.addLayer(aug25.selfMask(), {
//     palette: '#00e1d8'
// }, 'Flood areas 25')

var START = ee.Date('2023-08-03');
var END = START.advance(20, 'day');

// Map.addLayer(image3.selfMask());
// print(image3);

// /*
// constant
// */

// Map.addLayer(table, {}, 'table');

var agg = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
.select('total_precipitation_sum', 'runoff_sum')
.filterBounds(table)
.filterDate(START, END); // Define the date range you're interested in
// print(agg)


var extractPrecipitation = function(image) {
  return image.select('total_precipitation_sum', 'runoff_sum'); // 'tp' is the total precipitation band
};

// var runoff = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
// .select('total_precipitation_sum')
// .filterBounds(table)
// .filterDate(START, END);

// print(runoff)



// This has zero elements in it.
// var agg = prec
// .filterBounds(table)
// .filterDate('2023-07-02')
// .select('total_precipitation'); // Define the date range you're interested in
// print(agg);


// This has over 5000 elements.
// var agg = ee.ImageCollection('ECMWF/ERA5/DAILY')
//                   .select('total_precipitation')
//                   ;
// print(agg);


// var visTp = {
//   min: 0.0,
//   max: 0.1,
//   palette: ['ffffff', '00ffff', '0080ff', 'da00ff', 'ffa400', 'ff0000']
// };

// Map.addLayer(
//     agg.filter(ee.Filter.date('2023-07-15')), visTp,
//     'Daily total precipitation sums');


// // Map the function over the ImageCollection to extract precipitation bands
var precipCollection = agg.map(extractPrecipitation).toBands().clip(table);
// print("Precip Collection", precipCollection);

// var tps_20230803 = precipCollection.select("20230803_total_precipitation_sum");

// // // Add the layer to the map
// Map.addLayer(tps_20230803, {palette: '000000'}, "tps");

// // Center the map on the layer
// Map.centerObject(tps_20230803);


var elev = dem.clip(table);
// print(elev)
var slope = ee.Terrain.slope(dem).clip(table);
// print(slope)

// print(elev);
precipCollection = precipCollection.addBands(elev, ['elevation']);
precipCollection = precipCollection.addBands(slope, ['slope']);
precipCollection = precipCollection.addBands(tpi_large, ['elevation'], false);
precipCollection = precipCollection.addBands(tpi_small, ['elevation'], false);
// print("Precip Collection", precipCollection);
// print(srcImg);

// // var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterDate('2023-01-01', '2023-08-01'); //.filterBounds(roi);
// // var dwImage = ee.Image(dw.mosaic());//.clip(roi); print('DW ee. Image', dwImage);
// // // // // Display the the classified image using the label band.

// // var classification = dwImage.select('label').clip(table).select(['label'], ['lulc']);
// // Map.addLayer(classification,{}, 'lulc');
// print(lulc_computed);
lulc_computed = lulc_computed.select(['label'], ['lulc']);

precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false);

var bands = precipCollection.bandNames();

// print(bands);
precipCollection = precipCollection.addBands(aug13, ['constant']);
print(precipCollection);

var label = 'constant';
var randomPoints = ee.FeatureCollection.randomPoints(table, 10000);

randomPoints = randomPoints.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(), // Choose a reducer, 'first' will get the value at the first pixel within the point
    geometry: ee.FeatureCollection(feature),
    scale: 30 // Adjust scale as needed
  }).get('constant');

  return feature.set('label', value); // Set the 'label' property to the value of band 'x'
});


var training = precipCollection.sampleRegions({
  // Get the sample from the polygons FeatureCollection.
  collection: randomPoints,
  // Keep this list of properties from the polygons.
  properties: ['label'],
  // Set the scale to get Landsat pixels in the polygons.
  scale: 30
});

training = training.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(), // Choose a reducer, 'first' will get the value at the first pixel within the point
    geometry: ee.FeatureCollection(feature),
    scale: 30 // Adjust scale as needed
  }).get('constant');

  return feature.set('label', value); // Set the 'label' property to the value of band 'x'
});

// // Export.table.toDrive({
// //   collection: training,
// //   description: 'training_data_export',
// //   fileFormat: 'GeoJSON',
// //   // selectors: [] // Optional: select specific properties to include in the GeoJSON
// // });

// // print(training);
// // Create an SVM classifier with custom parameters.
// var classifier = ee.Classifier.libsvm({
//   kernelType: 'RBF',
//   gamma: 0.5,
//   cost: 10
// });

var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 2000 // Number of trees in the forest.
});

// // var classifier = ee.Classifier.smileRandomForest(10);
// // Train the classifier. 
var trained = classifier.train(training, 'constant', bands);

var confusionMatrix = trained.confusionMatrix();
print('Confusion Matrix:', confusionMatrix);


// // print("Confusion Matrix", trained.confusionMatrix());
// // Classify the image.
var classified = precipCollection.select(bands).classify(trained);


print(classified);
Map.addLayer(classified.selfMask(),{palette : 'red'}, "classified");
Map.addLayer(precipCollection.select('constant'), {}, "precipCollection");

Map.addLayer(classified.selfMask(), {
    palette: 'royalblue'
}, 'Flood areas')

// Export.classifier.toAsset(trained);
// // Get the value from the dictionary
// // var valueAtPoint = value.get('bandName');
// var randomPoints1 = precipCollection.select('constant').sample({
//   region: table,  // Use the image geometry as the region
//   scale: 30,                  // Adjust scale as needed
//   numPixels: 100        // Number of points to sample
// });

// var value = precipCollection.select('constant').reduceRegion({
//   reducer: ee.Reducer.first(), // Choose a reducer, 'first' will get the value at the first pixel within the point
//   geometry: geometry,
//   scale: 30 // Adjust scale as needed
// });

// print(value);
// // Get the value from the dictionary
// var valueAtPoint = value.get('bandName');


// print(randomPoints);

// print(precipCollection.select(bands), "precipCollection.select(bands)");

// var training = precipCollection.select(bands).sampleRegions({
//   collection: randomPoints1,
//   properties: ['label'], // Assuming your classes are labeled with the property 'class'
//   scale: 30 // Adjust scale as needed
// });


// print('training', training);
// // Train a classifier (e.g., Random Forest)
// var classifier = ee.Classifier.smileCart().train({
//   features : training,
//   classProperty :  'constant',
//   inputProperties : bands
// });

// print(classifier);
// // // Apply the classifier to the entire study area
// var classified =  precipCollection.classify(classifier, "output");

// Map.addLayer(classified, {}, "classified");



// var START = ee.Date('2023-07-25');
// var END = START.advance(20, 'day');

// /*
// constant
// */
// var agg = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
// .select(['total_precipitation_sum', 'runoff_sum'], ['prec', 'runoff'])
// .filterBounds(table)
// .filterDate(START, END); // Define the date range you're interested in

// var extractPrecipitation = function(image) {
//   return image.select(['prec', 'runoff']); // 'tp' is the total precipitation band
// };

// // Map the function over the ImageCollection to extract precipitation bands
// var precipCollection = agg.map(extractPrecipitation).toBands().clip(table);

// precipCollection = precipCollection.addBands(elev, ['elevation']);
// precipCollection = precipCollection.addBands(tpi_large, ['elevation'], false);
// precipCollection = precipCollection.addBands(tpi_small, ['elevation'], false);
// precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false);

// print(precipCollection);
// var classified = precipCollection.select(bands).classify(trained);

// print(classified);
// Map.addLayer(classified,{}, "classified_25-07");

