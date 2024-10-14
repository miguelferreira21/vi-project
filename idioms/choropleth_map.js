let svg, mapGroup, colorScale, legendHeight;
let currentData, initialExtent;

function createChoroplethMap(data, containerId) {
  currentData = data;
  // Set up dimensions
  const margin = { top: scaleValue(20), right: scaleValue(20), bottom: scaleValue(50), left: scaleValue(80) };
  const width = scaleValue(REFERENCE_WIDTH / 2);
  const height = scaleValue(3 * (REFERENCE_HEIGHT / 7));

  // Create SVG
  svg = d3.select(containerId)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Create a group for the map and transformations
  mapGroup = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create a color scale based on initial data
  initialExtent = d3.extent(data, d => d.happiness_score);
  colorScale = d3.scaleSequential(d3.interpolateBlues)
    .domain(initialExtent);

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

    // Create static legend based on initial data
    createStaticLegend(currentData);

    // Initial update
    updateChoroplethMap(currentData);
  });
}

function updateChoroplethMapSize() {
  const width = scaleValue(REFERENCE_WIDTH / 2);
  const height = scaleValue(3 * (REFERENCE_HEIGHT / 7));

  svg
      .attr("width", width)
      .attr("height", height);

  // Update projection and path
  const countries = mapGroup.selectAll("path").data();
  const projection = d3.geoMercator().fitSize([width, height], {type: "FeatureCollection", features: countries});
  const path = d3.geoPath().projection(projection);

  mapGroup.selectAll("path")
      .attr("d", path);

  // Update legend position
  svg.select(".choropleth-legend")
      .attr("transform", `translate(${width - scaleValue(60)}, ${height - scaleValue(220)})`);
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

  // Use the initial extent for coloring, not the current data extent
  console.log("Happiness score extent (initial):", initialExtent);

  // Update map colors
  mapGroup.selectAll("path")
    .attr("fill", d => {
      if (!d || !d.properties) {
        return "#ccc";
      }
      const countryData = processedData.find(item => item.country === d.properties.name);
      return countryData ? colorScale(countryData.happiness_score) : "#ccc";
    });
 
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

function createStaticLegend(initialData) {
  const extent = d3.extent(initialData, d => d.happiness_score);
  
  const legendWidth = 20;
  const legendHeight = 180;

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

  // Use the same color scale as defined in createChoroplethMap
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

  // Check for -999 values and set to "N/A" if true
  const fertilityRate = countryData.fertility_rate === -999 ? "N/A" : countryData.fertility_rate.toFixed(2);
  const temperature = countryData.temperature === -999 ? "N/A" : countryData.temperature.toFixed(2);

  // Construct temperature display string
  const temperatureDisplay = countryData.temperature === -999 ? temperature : `${temperature} ºC`;
  
  tooltip.html(`
    <strong>${d.properties.name}</strong><br>
    Happiness Score: ${countryData.happiness_score.toFixed(2)}<br>
    GDP per capita: ${countryData.gdp_per_capita.toFixed(2)} GK$<br>
    Social support: ${countryData.social_support.toFixed(2)}<br>
    Healthy life expectancy: ${countryData.healthy_life_expectancy.toFixed(2)}<br>
    Temperature: ${temperatureDisplay}<br>
    Fertility Rate: ${fertilityRate}
  `)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 28) + "px");
}

function hideTooltip() {
  d3.select(".tooltip").remove();
}

function preprocessData(data) {
  // Group the data by country
  const groupedData = d3.group(data, d => d.country);

  // Calculate averages for each country
  const averagedData = Array.from(groupedData, ([country, entries]) => {
    const average = arr => d3.mean(arr, d => parseFloat(d));

    // Calculate averages for each attribute
    const avgHappinessScore = average(entries.map(d => d.happiness_score));
    const avgGdpPerCapita = average(entries.map(d => d.gdp_per_capita));
    const avgSocialSupport = average(entries.map(d => d.social_support));
    const avgHealthyLifeExpectancy = average(entries.map(d => d.healthy_life_expectancy));
    const avgTemperature = average(entries.map(d => d.temperature));
    const avgFertilityRate = average(entries.map(d => d.fertility_rate));



    return {
      country: country,
      happiness_score: avgHappinessScore,
      gdp_per_capita: avgGdpPerCapita,
      social_support: avgSocialSupport,
      healthy_life_expectancy: avgHealthyLifeExpectancy,
      temperature: avgTemperature,
      fertility_rate: avgFertilityRate
    };
  });

  return averagedData;
}