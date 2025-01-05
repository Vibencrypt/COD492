# Flood Prediction in the Kosi River Basin: ECMWF ERA5 Data Analysis

## Overview
This project predicts flood-prone areas in the Kosi River Basin using
ECMWF ERA5 Land data. The dataset provides daily aggregated data on
precipitation and runoff. The data is filtered for the Kosi River Basin
and a time range from August 3, 2023, to August 23, 2023.

The ECMWF ERA5 Land data is filtered to include only relevant variables:
precipitation and runoff. Terrain features like elevation, slope, and
land use/land cover (LULC) are added from other datasets to provide more
context for the flood prediction model.

A Random Forest classifier is trained to predict flood-prone areas using
data from random sampling points in the basin. The model is trained on
precipitation, runoff, and terrain features to help predict floods. After
training, the classifier is used to predict flood-prone areas, aiding in
flood prediction for the Kosi River Basin.

## Documentation

### Introduction/Imports
In the `import.js` script, several variables are defined, such as:

- **table**: The region of interest in the Kosi River Basin.
- **dem**: Digital Elevation Model (DEM) dataset providing elevation data.
- **geometry**: A spatial object defining the area of interest, the Kosi
  River Basin.
- **prec**: The ECMWF ERA5 daily precipitation dataset.
- **lulc**: Land Use/Land Cover data, imported from Google's Dynamic World.
- **aug13, aug25**: Binary flood maps from Sentinel-1 SAR imagery.
- **tpi_small, tpi_large**: Terrain Position Index (TPI) data showing land
  roughness.
- **lulc_computed**: Pre-calculated land use and land cover data for the
  region.

### Methodology
To generate the binary flood maps **aug13** and **aug25**, the
pre-processing script (`preprocess.js`) is run. The Sentinel-1 SAR imagery
is clipped to the region of interest, and datasets like elevation and
land use/land cover (LULC) are processed. This provides context for how
land features affect flooding.

For flood detection, Sentinel-2 images are used to calculate the Normalized
Difference Water Index (NDWI), identifying water areas. Otsu's thresholding
method separates water from land, creating a flood mask.

Daily precipitation data is summed to observe rainfall patterns, helping
to determine flood contributions. Terrain features such as slope and
elevation are added to understand their impact on flood risk.

Flood images for dates like **August 13** and **August 25** are processed
to detect flood events. The binary flood maps are exported and imported
for classifier training.

The classifier script processes flood-prone areas in the Kosi River Basin
using machine learning. It visualizes flood areas for specific dates
(August 13 and August 25) with color-coded layers. The analysis period
is from August 3, 2023, to August 23, 2023.

Next, the script loads and filters precipitation and runoff data from the
ECMWF ERA5 dataset. The relevant data is extracted and clipped to the
Kosi River Basin.

To enhance the model, topographic data like elevation and slope are added
to the precipitation data. LULC data is also included to understand how
land type affects flooding.

Random points are generated within the region for training. Data from
precipitation, runoff, and terrain features is sampled at these points.
Each sample is labeled based on the constant value from the image.

The script then trains a Random Forest classifier using the training data.
The classifier is applied to the precipitation data to classify flood-prone
areas. The classified areas are visualized on the map with color-coded
layers for better understanding.

In summary, the script processes precipitation, terrain, and land use data,
trains a machine learning model to predict flood-prone areas, and visualizes
the results to help understand flood risks in the Kosi River Basin.

As the number of trees in the Random Forest model increases, evaluation
metrics such as precision, accuracy, recall, and F1-score will change.
By varying the number of trees, the trend of these measures can be
observed.
