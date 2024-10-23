let svg, mapGroup, colorScale, legendHeight;
let currentData, initialExtent;
let tooltip;
let selectedCountry = null;

function createChoroplethMap(data, containerId) {
  currentData = data;
  // Set up dimensions
  const width = d3.select(containerId).node().clientWidth*0.995;
  const height = d3.select(containerId).node().clientHeight*4.65;

  // Create SVG
  svg = d3.select(containerId)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Create a group for the map and transformations
  mapGroup = svg.append("g");

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
    const initialXOffset = width*0.35;
    const initialYOffset = height*0.05;

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

    // Create tooltip once
    tooltip = d3.select("body").append("div")
    .attr("class", "tooltip") // Ensure this class is styled in CSS
    .style("position", "absolute")
    .style("background-color", "lightsteelblue")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("border-radius", "5px")
    .style("font-family", "Arial")
    .style("font-size", "14px")
    .style("padding", "5px")
    .style("pointer-events", "none") // Allows mouse events to pass through
    .style("opacity", 0); // Initially hidden

    // Subscribe to updates
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);
    LinkedCharts.subscribe('parallelCoordinatesFilter', handleParallelCoordinatesFilter);
    LinkedCharts.subscribe('countrySelection', handleCountrySelectionFromParallel);


    // Create static legend based on initial data
    createStaticLegend(currentData, width, height);

    // Initial update
    updateChoroplethMap(currentData);
  });
}

function handleYearRangeUpdate(yearRange) {
  const { startYear, endYear, selectedYear } = yearRange;
  
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
  
  if (filteredData.length === 0) {
    return; // Skip if no data is found
  }
  
  updateChoroplethMap(filteredData);
}

function handleDataUpdate(newData) {
  currentData = newData;
  updateChoroplethMap(currentData);
}

function handleParallelCoordinatesFilter(filteredData) {
  updateChoroplethMap(filteredData);
}

    function updateChoroplethMap(data) {
        // Data pre-processing
        const processedData = preprocessData(data);

        // Update map colors and event listeners
        mapGroup.selectAll("path")
            .attr("fill", d => {
                if (!d || !d.properties) {
                    return "#ccc";
                }
                const countryData = processedData.find(item => item.country === d.properties.name);
                return countryData ? colorScale(countryData.happiness_score) : "#ccc";
            })
            .attr("stroke", d => {
                return d.properties && d.properties.name === selectedCountry ? "#8B0000" : "#fff"; // Dark red for selected country
            })
            .attr("stroke-width", d => {
                return d.properties && d.properties.name === selectedCountry ? 0.75 : 0.25; // Maintain stroke width for selected country
            })
            .on("mouseover", function(event, d) {
                if (!d || !d.properties) return;
                d3.select(this)
                    .raise()
                    .attr("stroke", "#000") // Change stroke color to black on hover
                    .attr("stroke-width", d.properties.name === selectedCountry ? 0.75 : 0.50); // Keep stroke width for selected country
                const countryData = processedData.find(item => item.country === d.properties.name);
                if (countryData) {
                    showTooltip(event, d, countryData);
                }
            })
            .on("mousemove", function(event, d) {
                if (!d || !d.properties) return;
                const countryData = processedData.find(item => item.country === d.properties.name);
                if (countryData) {
                    updateTooltipPosition(event);
                }
            })
            .on("mouseout", function(event, d) {
                // Revert stroke color and width when mouse leaves
                d3.select(this)
                    .attr("stroke", d.properties && d.properties.name === selectedCountry ? "#8B0000" : "#fff") // Revert to original stroke color
                    .attr("stroke-width", d.properties && d.properties.name === selectedCountry ? 0.75 : 0.25) // Maintain stroke width for selected country
                    .filter(function(d) {
                      return d.properties && d.properties.name !== selectedCountry
                    })
                    .lower();
                hideTooltip();
            })
            .on("click", function(event, d) {
                if (!d || !d.properties) return;
                const countryName = d.properties.name;
                handleCountrySelection(countryName, processedData);
                // Hide tooltip when clicking
                hideTooltip();
            });
    }

    function handleCountrySelection(countryName, data) {
        if (selectedCountry === countryName) {
            // Deselect the country
            selectedCountry = null;
            LinkedCharts.publish('countrySelection', null);
        } else {
            // Select the country
            selectedCountry = countryName;
            const countryData = data.find(item => item.country === countryName);
            LinkedCharts.publish('countrySelection', countryData);
        }
        updateChoroplethMap(currentData); // Update the map with the current data
    }

    function handleCountrySelectionFromParallel(selection) {
        if (selection && selection.country) {
            selectedCountry = selection.country;
        } else {
            selectedCountry = null;
        }
        updateChoroplethMap(currentData);
    }


    function createStaticLegend(initialData, width, height) {
      const extent = d3.extent(initialData, d => d.happiness_score);
      
      const legendWidth = width*0.025;
      const legendHeight = height*0.55;
    
      const legend = svg.append("g")
        .attr("class", "choropleth-legend")
        .attr("transform", `translate(${width*0.85}, ${height*0.35})`);
    
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
        .style("font-size", height * 0.03)
        .call(legendAxis);
    
      // Add title to legend
      legend.append("text")
        .attr("x", width*0.01)
        .attr("y", -height*0.05)
        .attr("text-anchor", "middle")
        .style("font-family", "Arial")
        .style("font-size", height*0.04)
        .text("Happiness Score");
    }
    
    function showTooltip(event, d, countryData) {
      // Check for -999 values and set to "N/A" if true
      const fertilityRate = countryData.fertility_rate === -999 ? "N/A" : countryData.fertility_rate.toFixed(2);
      const temperature = countryData.temperature === -999 ? "N/A" : countryData.temperature.toFixed(2);
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
      .style("top", (event.pageY - 28) + "px")
      .transition()
      .duration(60)
      .style("opacity", 0.9);
    }
    
    // Update tooltip position during mousemove
    function updateTooltipPosition(event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    }
    
    function hideTooltip() {
      tooltip
        .transition()
        .duration(60)
        .style("opacity", 0);
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



