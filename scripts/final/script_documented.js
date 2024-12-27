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

/* 
*******************************
* Detailed Documentationsh
START: Defines the starting date for the analysis as August 3, 2023.
END: Defines the end date by advancing 20 days from the start date, setting the range to end on August 23, 2023.
*******************************
*/

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

/* 
*******************************
agg: Creates an ImageCollection using ECMWF ERA5 daily data. It selects the 'total_precipitation_sum' and 'runoff_sum' bands 
and filters the collection based on the area of interest (table) and the date range defined by START and END.
*******************************
*/

var extractPrecipitation = function(image) {
  return image.select('total_precipitation_sum', 'runoff_sum'); // 'tp' is the total precipitation band
};

/* 
*******************************
extractPrecipitation function: Selects the relevant bands ('total_precipitation_sum' and 'runoff_sum') from each image 
in the ImageCollection to focus on precipitation and runoff data.
*******************************
*/

// var runoff = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
// .select('total_precipitation_sum')
// .filterBounds(table)
// .filterDate(START, END);

// print(runoff)

/* 
*******************************
Commented-out code is an alternative approach for getting only precipitation data, but it is not used in this block.
*******************************
*/

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

/* 
*******************************
Visually configure the precipitation data: Defines visualization parameters such as the color palette 
for displaying the precipitation values in the map. This block is currently commented out.
*******************************
*/

// // Map the function over the ImageCollection to extract precipitation bands
var precipCollection = agg.map(extractPrecipitation).toBands().clip(table);
// print("Precip Collection", precipCollection);

/* 
*******************************
precipCollection: Applies the extractPrecipitation function to the ImageCollection 'agg', 
which returns a collection of precipitation data. The data is then converted into bands 
and clipped to the region of interest defined by 'table'.
*******************************
*/

var elev = dem.clip(table);
// print(elev)
var slope = ee.Terrain.slope(dem).clip(table);
// print(slope)

/* 
*******************************
elev: Clips the elevation data (dem) to the region of interest (table). 
slope: Calculates the slope from the DEM (digital elevation model) data and clips it to the same region.
*******************************
*/

precipCollection = precipCollection.addBands(elev, ['elevation']);
precipCollection = precipCollection.addBands(slope, ['slope']);
precipCollection = precipCollection.addBands(tpi_large, ['elevation'], false);
precipCollection = precipCollection.addBands(tpi_small, ['elevation'], false);
// print("Precip Collection", precipCollection);
// print(srcImg);

/* 
*******************************
Adding additional bands: The precipitation data is enriched by adding additional bands for elevation, slope,
and terrain ruggedness (tpi_large and tpi_small). This will provide more context to the model or analysis.
*******************************
*/

lulc_computed = lulc_computed.select(['label'], ['lulc']);

precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false);

/* 
*******************************
lulc_computed: Selects the land-use/land-cover classification label and renames it as 'lulc'. 
This band is then added to the precipCollection.
*******************************
*/

var bands = precipCollection.bandNames();

// print(bands);
precipCollection = precipCollection.addBands(aug13, ['constant']);
print(precipCollection);

/* 
*******************************
bands: Retrieves the names of all the bands in the precipCollection. 
The 'constant' band (aug13) is added to the collection with the name 'constant'.
*******************************
*/

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

/* 
*******************************
randomPoints: Generates a collection of random points within the 'table' area and assigns the 'constant' 
value from precipCollection to each point using reduceRegion.
*******************************
*/

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

/* 
*******************************
training: Samples the precipCollection for each random point, obtaining the value of the 'constant' band. 
This data is used for training the classifier.
*******************************
*/

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
  numberOfTrees: 100 // Number of trees in the forest.
});

// // var classifier = ee.Classifier.smileRandomForest(10);
// // Train the classifier. 
var trained = classifier.train(training, 'constant', bands);

var confusionMatrix = trained.confusionMatrix();
print('Confusion Matrix:', confusionMatrix);

/* 
*******************************
classifier: Defines a random forest classifier with 100 trees for classification. 
The classifier is trained using the training data and evaluated using a confusion matrix.
*******************************
*/


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

/* 
*******************************
The remaining code (currently commented out) includes export options, 
random point sampling, and additional methods for evaluating the classification and training process.
*******************************
*/
