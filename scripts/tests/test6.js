
var table = ee.FeatureCollection("projects/ee-atharv/assets/COL865/geometry_box_export"),
    dem = ee.Image("USGS/SRTMGL1_003"),
    image2 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_1Aug_edition2"),
    image3 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_aug1_v3"),
    geometry = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "marker"
      },
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry({
      "type": "GeometryCollection",
      "geometries": [
        {
          "type": "Point",
          "coordinates": [
            85.51537386399455,
            25.246062009713217
          ]
        },
        {
          "type": "Polygon",
          "coordinates": [
            [
              [
                82.19000926266688,
                26.257179132707943
              ],
              [
                82.19000926266688,
                25.68432224106665
              ],
              [
                83.92584910641688,
                25.68432224106665
              ],
              [
                83.92584910641688,
                26.257179132707943
              ]
            ]
          ],
          "geodesic": false,
          "evenOdd": true
        }
      ],
      "coordinates": []
    }),
    prec = ee.ImageCollection("ECMWF/ERA5/DAILY"),
    lulc = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1"),
    aug13 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_13aug"),
    aug25 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_25Aug"),
    tpi_large = ee.Image("projects/ee-atharv/assets/TPI_large_roi"),
    tpi_small = ee.Image("projects/ee-atharv/assets/COL865/TPI_small_region"),
    imageCollection = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR"),
    lulc_computed = ee.Image("projects/ee-atharv/assets/COL865/lulc_dynamic_world");

Map.addLayer(image3.selfMask(), {
    palette: '#00e1d8'
}, 'Flood areas 3')

Map.addLayer(aug13.selfMask(), {
    palette: '#00e1d8'
}, 'Flood areas 13')

Map.addLayer(aug25.selfMask(), {
    palette: '#00e1d8'
}, 'Flood areas 25')

var START = ee.Date('2023-08-03');
var END = START.advance(20, 'day');

Map.addLayer(table, {}, 'table');

var agg = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
.select('total_precipitation_sum', 'runoff_sum')
.filterBounds(table)
.filterDate(START, END);

var extractPrecipitation = function(image) {
  return image.select('total_precipitation_sum', 'runoff_sum');
};

print(agg);
var visTp = {
  palette: ['ffffff', '00ffff', '0080ff', 'da00ff', 'ffa400', 'ff0000']
};

var precipCollection = agg.map(extractPrecipitation).toBands().clip(table);
print("Precip Collection", precipCollection);

var tps_20230803 = precipCollection.select("20230803_total_precipitation_sum");
Map.addLayer(tps_20230803, {pallete : visTp} ,"tps");

var elev = dem.clip(table);
var slope = ee.Terrain.slope(dem).clip(table);

print(elev);
precipCollection = precipCollection.addBands(elev, ['elevation']);
precipCollection = precipCollection.addBands(slope, ['slope']);
precipCollection = precipCollection.addBands(tpi_large, ['elevation'], false);
precipCollection = precipCollection.addBands(tpi_small, ['elevation'], false);

lulc_computed = lulc_computed.select(['label'], ['lulc']);
precipCollection = precipCollection.addBands(lulc_computed, ['lulc'], false);

var bands = precipCollection.bandNames();

print(bands);
precipCollection = precipCollection.addBands(aug13, ['constant']);
print(precipCollection);

var label = 'constant';
var randomPoints = ee.FeatureCollection.randomPoints(table, 10000);

randomPoints = randomPoints.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: ee.FeatureCollection(feature),
    scale: 30
  }).get('constant');

  return feature.set('label', value);
});

var training = precipCollection.sampleRegions({
  collection: randomPoints,
  properties: ['label'],
  scale: 30
});

training = training.map(function(feature) {
  var value = precipCollection.select('constant').reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: ee.FeatureCollection(feature),
    scale: 30
  }).get('constant');

  return feature.set('label', value);
});

var classifier = ee.Classifier.libsvm({
  kernelType: 'RBF',
  gamma: 0.5,
  cost: 10
});

var trained = classifier.train(training, 'constant', bands);

var classified = precipCollection.select(bands).classify(trained);

print(classified);
Map.addLayer(classified.selfMask(),{palette : 'red'}, "classified");
Map.addLayer(precipCollection.select('constant'), {}, "precipCollection");

Map.addLayer(classified.selfMask(), {
    palette: 'royalblue'
}, 'Flood areas')

