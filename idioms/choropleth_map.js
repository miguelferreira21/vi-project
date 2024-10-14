let svg, mapGroup, colorScale, legendHeight;
let currentData;

function createChoroplethMap(data, containerId) {
  currentData = data;
  // Set up dimensions
  const margin = { top: 20, right: 20, bottom: 50, left: 80 };
  const width = window.innerWidth/2;
  const height = 3*(window.innerHeight/7);

  // Create SVG
  svg = d3.select(containerId)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Create a group for the map and transformations
  mapGroup = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create a color scale
  colorScale = d3.scaleSequential(d3.interpolateBlues);

  // Load world map data
  d3.json("./data/countries-50m.json").then(function(worldData) {
    const countries = topojson.feature(worldData, worldData.objects.countries);
  
    // Create a map projection
    const projection = d3.geoMercator()
      .fitSize([width, height], countries);

    // Create a path generator
    const path = d3.geoPath().projection(projection);

    // Calculate the bounding box of the map
    const bounds = path.bounds(countries);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;
    const scale = 0.9 / Math.max(dx / width, dy / height);
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    // Set initial zoom and offset
    const initialZoomFactor = 1.60;
    const initialXOffset = 350;
    const initialYOffset = 23;

    // Calculate the initial transform
    const initialTransform = d3.zoomIdentity
      .translate(translate[0] - initialXOffset, translate[1] - initialYOffset)
      .scale(scale * initialZoomFactor);

    // Add zoom functionality
    const zoom = d3.zoom()
      .scaleExtent([scale * initialZoomFactor, 8])
      .translateExtent([[0, 0], [width, height]])
      .on("zoom", zoomed);

    svg.call(zoom)
      .call(zoom.transform, initialTransform);

    function zoomed(event) {
      mapGroup.attr("transform", event.transform);
    }

    // Draw the map
    mapGroup.selectAll("path")
      .data(countries.features)
      .join("path")
      .attr("d", path)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.05);

    // Subscribe to updates
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);

    // Initial update
    updateChoroplethMap(currentData);
  });
}

function handleYearRangeUpdate(yearRange) {
  console.log("Received yearRange update:", yearRange);
  const { startYear, endYear, selectedYear } = yearRange;
  console.log("startYear:", startYear, "endYear:", endYear, "selectedYear:", selectedYear);
  
  console.log("Current data sample:", currentData.slice(0, 5)); // Log a sample of current data
  
  const filteredData = currentData.filter(d => {
    const dataYear = parseInt(d.year);
    
    if (selectedYear !== null) {
      const result = dataYear === parseInt(selectedYear);
      return result;
    } else {
      const result = dataYear >= parseInt(startYear) && dataYear <= parseInt(endYear);
      return result;
    }
  });
  
  console.log("Filtered data length:", filteredData.length);
  console.log("Filtered data sample:", filteredData.slice(0, 5)); // Log a sample of filtered data
  
  if (filteredData.length === 0) {
    console.warn("No data found for the selected year range");
    return; // Skip if no data is found
  }
  
  updateChoroplethMap(filteredData);
}

function handleDataUpdate(newData) {
  currentData = newData;
  updateChoroplethMap(currentData);
}

function updateChoroplethMap(data) {
  // Data pre-processing
  const processedData = preprocessData(data);

  // Update color scale domain
  const extent = d3.extent(processedData, d => d.happiness_score);
  console.log("Happiness score extent:", extent);
  colorScale.domain(extent);

  // Update map colors
  mapGroup.selectAll("path")
    .attr("fill", d => {
      if (!d || !d.properties) {
        return "#ccc";
      }
      const countryData = processedData.find(item => item.country === d.properties.name);
      return countryData ? colorScale(countryData.happiness_score) : "#ccc";
    });
 
  // Update legend
  updateLegend(extent);

  // Add or update mouseover and mouseout events
  mapGroup.selectAll("path")
    .on("mouseover", function(event, d) {
      if (!d || !d.properties) return; // Skip if data is invalid
      d3.select(this).raise().attr("stroke", "#000").attr("stroke-width", 0.40);
      const countryData = processedData.find(item => item.country === d.properties.name);
      if (countryData) {
        showTooltip(event, d, countryData);
      }
    })
    .on("mouseout", function() {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.25);
      hideTooltip();
    });
}

function updateLegend(extent) {
  const legendWidth = 20;
  const legendHeight = 180;

  // Remove any existing legend
  svg.selectAll(".choropleth-legend").remove();

  // Create new legend group
  const legend = svg.append("g")
    .attr("class", "choropleth-legend")
    .attr("transform", `translate(${svg.attr("width") - 60}, ${svg.attr("height") - 220})`);

  const legendScale = d3.scaleLinear()
    .domain(extent)
    .range([legendHeight, 0]);


    const legendAxis = d3.axisRight(legendScale)
      .tickValues(d3.range(extent[0], extent[1], (extent[1] - extent[0]) / 5).concat(extent[1]))
      .tickFormat(d3.format(".2f"));

  // Create gradient
  const gradient = legend.append("defs")
    .append("linearGradient")
    .attr("id", "choropleth-legend-gradient")
    .attr("x1", "0%")
    .attr("y1", "100%")
    .attr("x2", "0%")
    .attr("y2", "0%");

  gradient.selectAll("stop")
    .data(d3.range(0, 1.1, 0.1))
    .enter()
    .append("stop")
    .attr("offset", d => d * 100 + "%")
    .attr("stop-color", d => colorScale(d3.quantile(extent, d)));

  // Create rectangle for the gradient
  legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#choropleth-legend-gradient)");

  // Add axis to legend
  legend.append("g")
    .attr("transform", `translate(${legendWidth}, 0)`)
    .call(legendAxis);

  // Add title to legend
  legend.append("text")
    .attr("x", 10)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Happiness Score");
}

function showTooltip(event, d, countryData) {
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("border-radius", "5px")
    .style("padding", "10px");

  tooltip.html(`
    <strong>${d.properties.name}</strong><br>
    Happiness Score: ${countryData.happiness_score.toFixed(2)}<br>
    GDP per capita: ${countryData.gdp_per_capita.toFixed(2)} GK$<br>
    Social support: ${countryData.social_support.toFixed(2)}<br>
    Healthy life expectancy: ${countryData.healthy_life_expectancy.toFixed(2)}
  `)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 28) + "px");
}

function hideTooltip() {
  d3.select(".tooltip").remove();
}

function preprocessData(data) {
  return data.map(d => {
    let country = d.country;
    if (country === "United States") country = "United States of America";
    else if (country === "Taiwan Province of China") country = "Taiwan";
    else if (country === "Dominican Republic") country = "Dominican Rep.";
    else if (country === "Bosnia and Herzegovina") country = "Bosnia and Herz.";
    else if (country === "Ivory Coast") country = "Côte d'Ivoire";
    else if (country === "North Macedonia") country = "Macedonia";
    else if (country === "Palestinian Territories") country = "Palestine";
    
    return {
      ...d,
      country: country,
      happiness_score: parseFloat(d.happiness_score),
      gdp_per_capita: parseFloat(d.gdp_per_capita),
      social_support: parseFloat(d.social_support),
      healthy_life_expectancy: parseFloat(d.healthy_life_expectancy)
    };
  });
}
