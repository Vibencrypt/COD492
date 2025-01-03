// This script defines various input assets utilized in the flood analysis project.

// Region of Interest (ROI) defined as a feature collection.
var table = ee.FeatureCollection("projects/assets/COL865/geometry_box_export"),

// Digital Elevation Model (DEM) from the USGS Shuttle Radar Topography Mission (SRTM).
// Provides elevation data to analyze terrain features such as slopes and mountains.
    dem = ee.Image("USGS/SRTMGL1_003"),

// Flood image (version 2) captured via remote sensing for flood-related analysis.
    image2 = ee.Image("projects/assets/flood_image_roi_export_1Aug_edition2"),

// Refined flood image (version 3) used for comparative analysis and accuracy improvement.
    image3 = ee.Image("projects/assets/flood_image_roi_export_aug1_v3"),

// Geometry object defining a point and a polygon for ROI masking and filtering.
    geometry = ee.Geometry({
        "type": "GeometryCollection", // Combines multiple geometries (point and polygon).
        "geometries": [
            {
                "type": "Point", // Single point geometry with specific coordinates.
                "coordinates": [
                    85.51537386399455, // Longitude
                    25.246062009713217  // Latitude
                ]
            },
            {
                "type": "Polygon", // Polygon geometry representing a rectangular area.
                "coordinates": [
                    [
                        [82.19000926266688, 26.257179132707943], // Vertex 1 (longitude, latitude)
                        [82.19000926266688, 25.68432224106665],  // Vertex 2
                        [83.92584910641688, 25.68432224106665],  // Vertex 3
                        [83.92584910641688, 26.257179132707943]   // Vertex 4
                    ]
                ],
                "geodesic": false, // Defined on a flat plane (non-geodesic).
                "evenOdd": true    // Inclusion determined by even-odd rule.
            }
        ]
    }),

// Daily precipitation data from the ECMWF ERA5 model.
// Useful for analyzing weather patterns, including rainfall intensity and duration.
    prec = ee.ImageCollection("ECMWF/ERA5/DAILY"),

// Land Use/Land Cover (LULC) data from the Google Dynamic World dataset.
// Provides classifications of land types, aiding in environmental analysis.
    lulc = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1"),

// Flood image for August 13, 2023, used for temporal flood event analysis.
    aug13 = ee.Image("projects/assets/flood_image_roi_export_13aug"),

// Flood image for August 25, 2023, representing another time point for flood monitoring.
    aug25 = ee.Image("projects/assets/flood_image_roi_export_25Aug"),

// Terrain Position Index (TPI) for a large region.
// Indicates terrain ruggedness, aiding in slope and flood modeling.
    tpi_large = ee.Image("projects/assets/TPI_large_roi"),

// TPI for a smaller region, providing localized terrain ruggedness data.
    tpi_small = ee.Image("projects/assets/COL865/TPI_small_region"),

// Daily aggregated data from ECMWF ERA5-LAND dataset.
// Contains land variables such as temperature and precipitation for temporal analysis.
    imageCollection = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR"),

// Pre-computed LULC image from the Dynamic World dataset for a specific region and time.
    lulc_computed = ee.Image("projects/assets/COL865/lulc_dynamic_world");
