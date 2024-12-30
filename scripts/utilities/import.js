// Define various input assets used in the analysis

// 'table' refers to a feature collection containing geometries for the area of interest.
// This is likely used to define regions or boundaries for further analysis.
var table = ee.FeatureCollection("projects/ee-atharv/assets/COL865/geometry_box_export"),

// 'dem' is a Digital Elevation Model (DEM) image from the USGS SRTM (Shuttle Radar Topography Mission).
// It provides elevation data, useful for understanding terrain features like slopes, mountains, etc.
    dem = ee.Image("USGS/SRTMGL1_003"),

// 'image2' is a flood image, likely captured from satellite or remote sensing, for flood analysis.
    image2 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_1Aug_edition2"),

// 'image3' is another version of a flood image, possibly a refined or updated version for comparison.
    image3 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_aug1_v3"),

// 'geometry' defines a complex geometry object consisting of both a point and a polygon.
// The point is specified by its latitude and longitude, while the polygon is defined by a series of coordinates.
// This geometry is used to mask or filter the region of interest for further analysis.
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
          "type": "GeometryCollection", // Geometry type is a collection of multiple geometries (point and polygon).
          "geometries": [
            {
              "type": "Point", // A single point geometry (latitude and longitude coordinates).
              "coordinates": [
                85.51537386399455, // Longitude
                25.246062009713217 // Latitude
              ]
            },
            {
              "type": "Polygon", // A polygon geometry representing a rectangular area.
              "coordinates": [
                [
                  [82.19000926266688, 26.257179132707943], // Polygon vertices (longitude, latitude)
                  [82.19000926266688, 25.68432224106665],
                  [83.92584910641688, 25.68432224106665],
                  [83.92584910641688, 26.257179132707943]
                ]
              ],
              "geodesic": false, // The polygon is defined using a flat plane (not geodesic).
              "evenOdd": true // Indicates whether the polygon is using even-odd rule for inclusion.
            }
          ],
          "coordinates": [] // No additional coordinates are specified for this geometry collection.
        }),

// 'prec' is an image collection containing daily precipitation data from the ECMWF ERA5 model.
// ERA5 provides historical weather data, including precipitation, temperature, etc.
    prec = ee.ImageCollection("ECMWF/ERA5/DAILY"),

// 'lulc' is an image collection representing Land Use/Land Cover (LULC) data, which maps land types.
// This data is sourced from the Google Dynamic World dataset, which classifies land cover into various categories.
    lulc = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1"),

// 'aug13' is a specific flood image for August 13, used for analysis at that point in time.
    aug13 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_13aug"),

// 'aug25' is another flood image for August 25, representing a different time point for flood monitoring.
    aug25 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_25Aug"),

// 'tpi_large' represents a terrain ruggedness index (TPI) image for a large region.
// TPI is used to measure the ruggedness of terrain, which can be useful for flood modeling, slope analysis, etc.
    tpi_large = ee.Image("projects/ee-atharv/assets/TPI_large_roi"),

// 'tpi_small' represents a smaller region of the terrain ruggedness index (TPI), providing similar information but for a more localized area.
    tpi_small = ee.Image("projects/ee-atharv/assets/COL865/TPI_small_region"),

// 'imageCollection' is an image collection containing daily aggregated data from the ECMWF ERA5-LAND dataset.
// This collection is likely used for temporal analysis of land variables such as temperature, precipitation, etc.
    imageCollection = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR"),

// 'lulc_computed' represents a specific LULC image computed from the Dynamic World dataset,
// showing the land use/land cover classification for a particular region or time.
    lulc_computed = ee.Image("projects/ee-atharv/assets/COL865/lulc_dynamic_world");
