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