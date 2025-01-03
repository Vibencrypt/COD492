# Import required libraries
import ee  # Google Earth Engine API
import numpy as np  # For numerical operations
import matplotlib.pyplot as plt  # For plotting graphs
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score  # For performance metrics

# Initialize the Earth Engine API
ee.Initialize()

# Function to call the JavaScript subroutine (outputting classification data and random points)
def get_gee_data():
    """
    This function assumes that the JavaScript code has been executed on Google Earth Engine.
    It fetches the pre-exported assets required for analysis.
    The assets include:
        - The classified image (predicted labels)
        - Random points with true labels ('constant' band)
    """
    # Asset IDs (update these with the actual exported asset IDs)
    classified_image_asset = 'users/your_account/classified_image'  # Replace with your asset ID
    random_points_asset = 'users/your_account/random_points'  # Replace with your asset ID

    # Load the classified image and random points from assets
    classified_image = ee.Image(classified_image_asset)
    random_points = ee.FeatureCollection(random_points_asset)

    return classified_image, random_points

# Function to calculate performance metrics for a given number of trees
def evaluate_rf_model(classified_image, random_points, num_trees):
    """
    Train and evaluate a Random Forest classifier with the specified number of trees.

    Parameters:
        classified_image: ee.Image
            The classified image containing predicted labels.
        random_points: ee.FeatureCollection
            A collection of points with ground truth labels ('constant').
        num_trees: int
            The number of trees to use in the Random Forest model.

    Returns:
        A dictionary containing the calculated metrics:
        - Accuracy, Precision, Recall, F1-score
    """
    # Add the number of trees as a metadata property
    classifier = ee.Classifier.smileRandomForest(numberOfTrees=num_trees)

    # Train the classifier using the random points as training data
    trained_classifier = classifier.train(
        features=random_points,
        classProperty='label',
        inputProperties=['bandNames']  # Replace with actual band names
    )

    # Classify the image using the trained classifier
    classified = classified_image.classify(trained_classifier)

    # Extract predictions and ground truth values for metrics calculation
    predictions = classified.reduceRegion(
        reducer=ee.Reducer.toList(),
        geometry=random_points.geometry(),
        scale=30  # Adjust scale to match resolution
    ).get('classification')  # Replace 'classification' with actual prediction band name

    ground_truth = random_points.reduceColumns(
        reducer=ee.Reducer.toList(),
        selectors=['label']
    ).get('list')

    # Convert EE lists to NumPy arrays
    predictions = np.array(predictions.getInfo())
    ground_truth = np.array(ground_truth.getInfo())

    # Calculate metrics
    accuracy = accuracy_score(ground_truth, predictions)
    precision = precision_score(ground_truth, predictions, average='macro', zero_division=0)
    recall = recall_score(ground_truth, predictions, average='macro', zero_division=0)
    f1 = f1_score(ground_truth, predictions, average='macro', zero_division=0)

    return {'accuracy': accuracy, 'precision': precision, 'recall': recall, 'f1_score': f1}

# Main script execution
def main():
    """
    Main script to evaluate the Random Forest classifier for varying numbers of trees
    and plot performance metrics.
    """
    # Call the JavaScript subroutine to get classified data and ground truth points
    classified_image, random_points = get_gee_data()

    # Range of tree counts to test
    tree_counts = [10, 50, 100, 200, 300, 500]

    # Initialize empty lists to store metrics
    accuracies = []
    precisions = []
    recalls = []
    f1_scores = []

    # Loop through each tree count and evaluate the model
    for num_trees in tree_counts:
        metrics = evaluate_rf_model(classified_image, random_points, num_trees)
        accuracies.append(metrics['accuracy'])
        precisions.append(metrics['precision'])
        recalls.append(metrics['recall'])
        f1_scores.append(metrics['f1_score'])

    # Plot the metrics against the number of trees
    plt.figure(figsize=(12, 8))

    # Accuracy plot
    plt.subplot(2, 2, 1)
    plt.plot(tree_counts, accuracies, marker='o', color='blue')
    plt.title('Accuracy vs. Number of Trees')
    plt.xlabel('Number of Trees')
    plt.ylabel('Accuracy')

    # Precision plot
    plt.subplot(2, 2, 2)
    plt.plot(tree_counts, precisions, marker='o', color='green')
    plt.title('Precision vs. Number of Trees')
    plt.xlabel('Number of Trees')
    plt.ylabel('Precision')

    # Recall plot
    plt.subplot(2, 2, 3)
    plt.plot(tree_counts, recalls, marker='o', color='orange')
    plt.title('Recall vs. Number of Trees')
    plt.xlabel('Number of Trees')
    plt.ylabel('Recall')

    # F1-score plot
    plt.subplot(2, 2, 4)
    plt.plot(tree_counts, f1_scores, marker='o', color='red')
    plt.title('F1-Score vs. Number of Trees')
    plt.xlabel('Number of Trees')
    plt.ylabel('F1-Score')

    # Display the plots
    plt.tight_layout()
    plt.show()

# Execute the main function
if __name__ == '__main__':
    main()
