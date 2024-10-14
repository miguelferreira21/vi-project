let globalData;

function init() {
  d3.csv("./data/dataset.csv").then(function (data) {
    globalData = data;
    
    createLineChart(data, ".LineChart");
    createChoroplethMap(data, ".Choropleth");
    //createRooftop_Matrix(data, ".Rooftop_Matrix");
    //createParallel_coordinates(data, ".Parallel_coordinates");

    // Filters
    createFilters(data, ".Filters")
    
    // Set up data binding
    setupDataBinding();
  });
}

function setupDataBinding() {
  // This function would set up any data binding mechanisms
  // For now, we'll just add a button to simulate data updates
  d3.select("body")
    .append("button")
    .text("Update Data")
    .on("click", updateData);
}

function updateData() {
  // In a real application, this function would fetch new data or apply filters
  // For this example, we'll just simulate a data change by modifying some values
  globalData.forEach(d => {
    d.happiness_score = Math.max(0, Math.min(10, +d.happiness_score + (Math.random() - 0.5)));
  });

  // Use the LinkedCharts system to update all charts
  LinkedCharts.publish('dataUpdate', globalData);
}

// Uncomment and update these functions when implementing them
/*
function createRooftop_Matrix(data, containerId) {
  // Implementation of createRooftop_Matrix
  // ...

  // Subscribe to updates
  LinkedCharts.subscribe('rooftop_matrix', updateRooftop_Matrix);
}

function updateRooftop_Matrix(data) {
  // Implementation of updateRooftop_Matrix
  // ...
}

function createParallel_coordinates(data, containerId) {
  // Implementation of createParallel_coordinates
  // ...

  // Subscribe to updates
  LinkedCharts.subscribe('parallel_coordinates', updateParallel_coordinates);
}

function updateParallel_coordinates(data) {
  // Implementation of updateParallel_coordinates
  // ...
}
*/

// Call init function when the page loads
window.onload = init;
