import pandas as pd

# Read the CSV file
df = pd.read_csv('./dataset.csv')

# Create a mapping dictionary for the region mergers
region_mapping = {
    'East Asia': 'East and Southeast Asia',
    'Southeast Asia': 'East and Southeast Asia'
}

# Create a new column with the merged regions
df['region'] = df['region'].map(lambda x: region_mapping.get(x, x))

# Save the modified dataset
df.to_csv('./dataset.csv', index=False)
