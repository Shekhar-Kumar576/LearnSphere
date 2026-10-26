# LearnSphere AI sample data

This package contains two complementary examples:

- `learnsphere-sample-dataset.json` is standalone educational content based on the prototype's sample lessons and supervised-learning quiz. It can support a demo, a content import, or documentation. It is not a machine-learning training corpus.
- `sample-house-prices.csv` is a small, synthetic supervised-learning example. Use `area_sqft`, `bedrooms`, and `age_years` as features and `price_usd` as a regression target. The values are illustrative and are not real market data.

The CSV has 16 rows and 5 columns, with no missing values. For a simple demonstration, reserve several rows as a test set before training. This toy dataset is too small to support meaningful real-world price predictions or formal performance claims.

## Relationship to the prototype

The source archive contains lesson and quiz examples embedded in the frontend and stores user-created chat/interview activity in SQLite. It does not contain a separate tabular training dataset. The JSON file externalises the educational examples; the CSV is an additional illustrative dataset for demonstrating the regression concept taught in the lesson.
