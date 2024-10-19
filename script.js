let globalData;

function init() {
  d3.csv("./data/dataset.csv").then(function (data) {
    globalData = data;
    
    createLineChart(data, ".LineChart");
    createChoroplethMap(data, ".Choropleth");
    createRooftopMatrix(data, ".Rooftop_Matrix");
    createParallelCoordinates(data, ".Parallel_coordinates");

    // Filters
    createFilters(data, ".Filters")
    
    // Set up data binding
    //setupDataBinding();
  });
}

/*function setupDataBinding() {
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
}*/

// Call init function when the page loads
window.onload = init;
