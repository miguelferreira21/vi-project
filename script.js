function init() {
  d3.csv("./data/dataset.csv").then(function (data) {
    createLineChart(data, ".LineChart");
    createChoroplethMap(data, ".Choropleth");
    //createRooftop_Matrix(data, ".Rooftop_Matrix");
    //createParallel_coordinates(data, ".Parallel_coordinates");
    
  });
}


// // Declare global variables to hold data for countries and capita
// var globalDataCountries;
// var globalDataCapita;


// // Define margin and dimensions for the charts
// const margin = {
//   top: 20,
//   right: 20,
//   bottom: 50,
//   left: 80,
// };
// const width = 500 - margin.left - margin.right;
// const height = 400 - margin.top - margin.bottom;


// // Function to start the dashboard
// function startDashboard() {
//   // Helper functions to load JSON and CSV files using D3's d3.json and d3.csv
//   function loadJSON(file) {
//     return d3.json(file);
//   }
//   function loadCSV(file) {
//     return d3.csv(file);
//   }


//   // Function to import both files (data.json and gapminder.csv) using Promise.all
//   function importFiles(file1, file2) {
//     return Promise.all([loadJSON(file1), loadCSV(file2)]);
//   }


//   // File names for JSON and CSV files
//   const file1 = "data.json";
//   const file2 = "gapminder.csv";


//   // Import the files and process the data
//   importFiles(file1, file2).then(function (results) {
//     // Store the JSON data into globalDataCountries using topojson.feature
//     globalDataCountries = topojson.feature(results[0], results[0].objects.countries);
    
//     // Store the CSV data into globalDataCapita
//     globalDataCapita = results[1];


//     // Convert incomeperperson and alcconsumption data to numbers
//     globalDataCapita.forEach(function (d) {
//       d.incomeperperson = +d.incomeperperson;
//       d.alcconsumption = +d.alcconsumption;
//     });


//     // Call functions to create the choropleth map and scatter plot
//     createChoroplethMap();
//     createScatterPlot();
//   });
// }



