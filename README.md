# Flood Prediction in the Kosi River Basin: ECMWF ERA5 Data Analysis

This project focuses on predicting flood-prone areas in the Kosi River Basin using ECMWF ERA5 Land data. The primary data used is sourced from the dataset, which provides daily aggregated data on total precipitation and runoff. The dataset is filtered by geographical boundaries and a time range to focus on the Kosi River Basin.

The project begins with selecting the date range for analysis, which is between August 3, 2023, and August 23, 2023. After defining the time range, the ECMWF ERA5 Land data is fetched and filtered to include only the necessary data. The data is then extracted to include only the precipitation and runoff data, which are the most important variables for flood prediction.

Terrain features such as elevation, slope, and land use/land cover (LULC) provide important context for flood prediction. These features are derived from existing datasets.

A Random Forest classifier is used to predict flood-prone areas in the Kosi River Basin. The process of training the model involves generating random sampling points within the Kosi River Basin, extracting data from these points, and training the classifier. The data for precipitation, runoff, and terrain features at each of the random points is extracted to form the training data.

The training data is then used to train the classifier, which uses the data from the training points to predict flood-prone areas in the Kosi River Basin. The model is trained on the data collected from the training points, which are then used to predict flood-prone areas in the Kosi River Basin.
