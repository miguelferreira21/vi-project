import os
import pandas as pd

# Folder where the CSV files are stored
folder_path = './data'

# Initialize a list to hold dataframes
dataframes = []

# Loop through all files in the folder
for filename in os.listdir(folder_path):
    if filename.startswith("WHR_") and filename.endswith(".csv"):
        # Extract the year from the filename (WHR_XXXX.csv)
        year = filename[4:8]
        
        # Read the CSV file
        file_path = os.path.join(folder_path, filename)
        df = pd.read_csv(file_path)
        
        # Add the 'year' column
        df['year'] = int(year)
        
        # Append the dataframe to the list
        dataframes.append(df)

# Find the common columns across all files
common_columns = set(dataframes[0].columns)
for df in dataframes[1:]:
    common_columns.intersection_update(df.columns)

# Convert back to list (preserving order)
common_columns = list(common_columns)

# Add 'year' column to the common columns (if not already included)
if 'year' not in common_columns:
    common_columns.append('year')

# Concatenate all dataframes, keeping only the common columns
merged_df = pd.concat([df[common_columns] for df in dataframes])

# Sort the merged dataframe by the 'year' column
merged_df = merged_df.sort_values(by='year')

# Reorder columns with year, country, region, and happiness_score first
ordered_columns = ['year', 'country', 'region', 'happiness_score']
# Add the remaining columns after the first four
remaining_columns = [col for col in merged_df.columns if col not in ordered_columns]
final_columns = ordered_columns + remaining_columns

# Reorder the DataFrame
merged_df = merged_df[final_columns]

# Replace 'Swaziland' with 'Eswatini', 'Czech Republic' with 'Czechia', and 'Congo (Brazzaville)' with 'Congo'
merged_df['country'] = merged_df['country'].replace({
    'Swaziland': 'Eswatini',
    'Czech Republic': 'Czechia',
    'Congo (Brazzaville)': 'Congo',
    'Hong Kong S.A.R. of China' : 'Hong Kong'
})

# Load the combined_temperature.csv file
temperature_df = pd.read_csv('./data/combined_temperature.csv')

# Rename columns for consistency
temperature_df = temperature_df.rename(columns={
    'Year': 'year',
    'Country': 'country',
    'Annual Mean': 'temperature'
})

# Replace 'Swaziland' with 'Eswatini', 'Czech Republic' with 'Czechia', and 'Congo (Brazzaville)' with 'Congo' in the temperature DataFrame
temperature_df['country'] = temperature_df['country'].replace({
    'Swaziland': 'Eswatini',
    'Czech Republic': 'Czechia',
    'Congo (Brazzaville)': 'Congo'
})

# Add the new name correspondences to the replacement dictionary
name_replacements = {
    "Congo, Dem. Rep.": "Congo",
    "Iran, Islamic Rep.": "Iran",
    "Cote d'Ivoire": "Ivory Coast",
    "Kyrgyz Republic": "Kyrgyzstan",
    "Russian Federation": "Russia",
    "Slovak Republic": "Slovakia",
    "Korea": "South Korea",
    "Venezuela, Rb": "Venezuela",
    "Yemen, Rep.": "Yemen"
}

# Apply the replacements to the temperature DataFrame
temperature_df['country'] = temperature_df['country'].replace(name_replacements)

# Merge the temperature data into the merged_df on 'year' and 'country'
final_merged_df = pd.merge(merged_df, temperature_df[['year', 'country', 'temperature']], on=['year', 'country'], how='left')

# Sort by 'country' and 'year'
final_merged_df = final_merged_df.sort_values(by=['country', 'year'])

# Count the number of years per country
country_year_counts = final_merged_df.groupby('country')['year'].nunique()

# Filter out countries with entries for less than 8 years
countries_with_at_least_8_years = country_year_counts[country_year_counts >= 8].index
final_merged_df = final_merged_df[final_merged_df['country'].isin(countries_with_at_least_8_years)]

# Find countries with missing temperature values and fill with -1
final_merged_df['temperature'] = final_merged_df['temperature'].fillna(-1)

# Function to replace missing and zero values with the average of that column for each country (numeric columns only)
def replace_missing_and_zero_with_country_avg(df, numeric_columns):
    for col in numeric_columns:
        # Group by 'country' and calculate the mean for each numeric column, ignoring zeros
        country_means = df[df[col] != 0].groupby('country')[col].mean()
        
        # Apply the mean for missing or zero values
        df[col] = df.apply(lambda row: country_means[row['country']] if pd.isnull(row[col]) or row[col] == 0 else row[col], axis=1)
    
    return df

# Get the list of numeric columns only (ignores non-numeric columns)
numeric_columns_to_fill = final_merged_df.select_dtypes(include=['number']).columns.difference(['year'])

# Apply the function to the numeric columns in the dataframe
final_merged_df = replace_missing_and_zero_with_country_avg(final_merged_df, numeric_columns_to_fill)

# Drop duplicates based on 'country' and 'year', keeping only the first occurrence
final_merged_df = final_merged_df.drop_duplicates(subset=['country', 'year'], keep='first')

# Load the fertility rate data from the CSV file
fertility_df = pd.read_csv('./data/API_SP.DYN.TFRT.IN_DS2_en_csv_v2_1890.csv')

# Strip any extra spaces from the column names (if necessary)
fertility_df.columns = fertility_df.columns.str.strip()

# Select only the 'Country Name' and '2022' columns
if '2022' in fertility_df.columns:
    fertility_df = fertility_df[['Country Name', '2022']].rename(columns={
        'Country Name': 'country',
        '2022': 'fertility_rate'
    })
else:
    raise ValueError("The column '2022' does not exist. Please check the file.")

fertility_df['country'] = fertility_df['country'].replace({
    'Hong Kong SAR, China' : 'Hong Kong',
    'Egypt, Arab Rep.' : 'Egypt',
    'Congo, Rep.' : 'Congo',
    'Iran, Islamic Rep.' : 'Iran',
    'Cote d\'Ivoire' : 'Ivory Coast',
    'Kyrgyz Republic' : 'Kyrgyzstan',
    'Russian Federation' : 'Russia',
    'Slovak Republic' : 'Slovakia',
    'Korea, Rep.' : 'South Korea',
    'Turkiye' : 'Turkey',
    'Venezuela, RB' : 'Venezuela',
    'Viet Nam' : 'Vietnam',
    'Yemen, Rep.' : 'Yemen'
})

# Merge the fertility data with the final_merged_df on the 'country' column
final_merged_df = pd.merge(final_merged_df, fertility_df[['country', 'fertility_rate']], on='country', how='left')

# Now you can count the number of entries per country again
entries_per_country = final_merged_df['country'].value_counts()

# Print each country with the number of entries
for country, count in entries_per_country.items():
    print(f"{country}: {count}")

# Find countries with missing fertility_rate values
missing_fertility_countries = final_merged_df[final_merged_df['fertility_rate'].isnull()]['country'].unique()

# Find countries with missing fertility rate values and fill with -1
final_merged_df['fertility_rate'] = final_merged_df['fertility_rate'].fillna(-1)

# Write the final merged dataframe to a new CSV file
output_file = 'WHR_merged_with_temperature_and_fertility.csv'
final_merged_df.to_csv(output_file, index=False)

print(f"Fertility rate data has been added and saved to {output_file}")
