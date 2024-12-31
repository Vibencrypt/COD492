// Define various input assets used in the analysis

// 'table' is a feature collection containing geometries that define the region of interest for the analysis.
// This collection can include points, polygons, or other types of spatial data.
var table = ee.FeatureCollection("projects/ee-atharv/assets/COL865/geometry_box_export"),

// 'dem' is a Digital Elevation Model (DEM) image from the USGS SRTM (Shuttle Radar Topography Mission).
// The DEM provides the elevation of the Earth's surface, which is useful for flood modeling, terrain analysis, and slope determination.
    dem = ee.Image("USGS/SRTMGL1_003"),

// 'image2' is an image representing flood data for a specific region. The flood data might be from satellite imagery or remote sensing.
// This image corresponds to the flood extent observed in the area at the time of the capture (possibly August 1).
    image2 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_1Aug_edition2"),

// 'image3' is another version of the flood image, possibly a revised or updated image representing flood data at the same or different time (possibly August 1).
    image3 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_aug1_v3"),

// 'geometry' is a collection of geometries (Point and Polygon), representing spatial areas of interest for the analysis.
// The Point geometry contains the coordinates of a specific location, and the Polygon defines a rectangular region of interest.
    geometry =
        /* color: #d63000 */
        /* shown: false */
        /* displayProperties: [
          {
            "type": "marker" // The point is marked on the map.
          },
          {
            "type": "rectangle" // The polygon represents a rectangular region.
          }
        ] */
        ee.Geometry({
          "type": "GeometryCollection", // Geometry collection that includes multiple types of geometries.
          "geometries": [
            {
              "type": "Point", // A point geometry with a specific latitude and longitude.
              "coordinates": [
                85.51537386399455, // Longitude of the point.
                25.246062009713217 // Latitude of the point.
              ]
            },
            {
              "type": "Polygon", // A polygon geometry representing a rectangular area.
              "coordinates": [
                [
                  [82.19000926266688, 26.257179132707943], // Coordinates of the polygon vertices.
                  [82.19000926266688, 25.68432224106665],
                  [83.92584910641688, 25.68432224106665],
                  [83.92584910641688, 26.257179132707943]
                ]
              ],
              "geodesic": false, // The polygon is non-geodesic, meaning it is defined on a flat plane.
              "evenOdd": true // The polygon uses the even-odd rule for inclusion of points inside it.
            }
          ],
          "coordinates": [] // No additional coordinates specified for this geometry collection.
        }),

// 'prec' is an image collection containing daily precipitation data from the ECMWF ERA5 model.
// ERA5 is a global reanalysis dataset providing historical weather data, including precipitation, which is useful for flood prediction.
    prec = ee.ImageCollection("ECMWF/ERA5/DAILY"),

// 'lulc' is an image collection representing Land Use/Land Cover (LULC) data. It helps in understanding how land is used or covered (e.g., forest, urban, agricultural).
// This collection is sourced from the Google Dynamic World dataset, which offers detailed land cover classification.
    lulc = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1"),

// 'aug13' is a flood image representing the region’s flood extent observed on August 13.
// It might be based on satellite or aerial imagery or other remote sensing data.
    aug13 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_13aug"),

// 'aug25' is another flood image, this one captured on August 25. It helps in comparing the flood dynamics between two time points in August.
    aug25 = ee.Image("projects/ee-atharv/assets/flood_image_roi_export_25Aug"),

// 'tpi_large' is an image representing the Terrain Ruggedness Index (TPI) for a large region.
// TPI is a measure of terrain complexity or ruggedness, often used to understand how water flows across the landscape, aiding flood modeling.
    tpi_large = ee.Image("projects/ee-atharv/assets/TPI_large_roi"),

// 'tpi_small' is another TPI image, but for a smaller region. It provides similar data as 'tpi_large' but for a more localized area.
    tpi_small = ee.Image("projects/ee-atharv/assets/COL865/TPI_small_region"),

// 'imageCollection' is a collection of daily aggregated data from the ECMWF ERA5-LAND dataset.
// This data is likely used for temporal analysis of land-related variables like precipitation, temperature, and land surface properties.
    imageCollection = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR"),

// 'lulc_computed' is a specific image computed from the Google Dynamic World dataset, representing land use/land cover classification for the region of interest.
    lulc_computed = ee.Image("projects/ee-atharv/assets/COL865/lulc_dynamic_world");
