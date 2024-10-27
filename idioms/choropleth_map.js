let svg, mapGroup, colorScale, legendHeight;
let currentData, initialExtent;
let tooltip;
let selectedCountry = null;
let width, height, zoom, initialTransform, projection, path;
let selectedRegion = null;
let isHandlingCountrySelection = false;
let regionColor = null;


function createChoroplethMap(data, containerId) {
  currentData = data;
  // Set up dimensions
  width = d3.select(containerId).node().clientWidth;
  height = d3.select(containerId).node().clientHeight;

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
    projection = d3.geoMercator()
      .fitSize([width, height], countries);

    // Create a path generator
    path = d3.geoPath().projection(projection);

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
    initialTransform = d3.zoomIdentity
      .translate(translate[0] - initialXOffset, translate[1] - initialYOffset)
      .scale(scale * initialZoomFactor);

    // Add zoom functionality
    zoom = d3.zoom()
      .scaleExtent([1, 8])
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
    LinkedCharts.subscribe('countrySelection', handleCountrySelectionFromParallel); // will never be used
    LinkedCharts.subscribe('regionHover', handleRegionHover);
    LinkedCharts.subscribe('regionSelection', handleRegionSelection);

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
  const processedData = preprocessData(data);
  
  function getCountriesInRegion(region, data) {
      return [...new Set(data.filter(d => d.region === region).map(d => d.country))];
  }
  
  const countriesInRegion = selectedRegion ? getCountriesInRegion(selectedRegion, currentData) : [];
  
  mapGroup.selectAll("path")
      .attr("fill", d => {
          if (!d || !d.properties) {
              return "#ccc";
          }
          const countryData = processedData.find(item => item.country === d.properties.name);
          return countryData ? colorScale(countryData.happiness_score) : "#ccc";
      })
      .attr("stroke", d => {
          if (!d || !d.properties) return "#fff";
          
          if (selectedCountry && d.properties.name === selectedCountry) {
              return "#8B0000";
          }
          if (selectedRegion && countriesInRegion.includes(d.properties.name)) {
              return regionColor;
          }
          return "#fff";
      })
      .attr("stroke-width", d => {
          if (!d || !d.properties) return 0.25;
          
          if (selectedCountry && d.properties.name === selectedCountry) {
              return 0.75;
          }
          if (selectedRegion && countriesInRegion.includes(d.properties.name)) {
              return 0.5;
          }
          return 0.25;
      })
      .filter(d => !selectedRegion || !countriesInRegion.includes(d.properties.name))
      .lower();

  mapGroup.selectAll("path")
      .on("mouseover", function(event, d) {
          if (!d || !d.properties) return;
          const countryData = processedData.find(item => item.country === d.properties.name);
          if (!countryData) return;
          
          d3.select(this)
              .raise()
              .attr("stroke", "#000")
              .attr("stroke-width", 0.5);
              
          showTooltip(event, d, countryData);
          LinkedCharts.publish('countryHover', d.properties.name);
      })
      .on("mouseout", function(event, d) {
          if (!d || !d.properties) return;
          
          d3.select(this)
              .attr("stroke", d => {
                  if (selectedCountry && d.properties.name === selectedCountry) {
                      return "#8B0000";
                  }
                  if (selectedRegion && countriesInRegion.includes(d.properties.name)) {
                      return regionColor;
                  }
                  return "#fff";
              })
              .attr("stroke-width", d => {
                  if (selectedCountry && d.properties.name === selectedCountry) {
                      return 0.75;
                  }
                  if (selectedRegion && countriesInRegion.includes(d.properties.name)) {
                      return 0.5;
                  }
                  return 0.25;
              })
              .filter(d => (!selectedCountry || d.properties.name !== selectedCountry) && (!selectedRegion || !countriesInRegion.includes(d.properties.name)))
              .lower();
              
          hideTooltip();
      })
      .on("click", function(event, d) {
          if (!d || !d.properties) return;
          const countryData = processedData.find(item => item.country === d.properties.name);
          if (!countryData) return;
          const countryName = d.properties.name;
          handleCountrySelection(countryName, processedData);
          hideTooltip();
      });
}

function handleCountrySelection(countryName, data) {
  // Set the flag to prevent circular updates
  isHandlingCountrySelection = true;
  
  console.log("Selected country:", selectedCountry, "Country name:", countryName); // Debug log
  
  // Clear region selection regardless
  selectedRegion = null;
  LinkedCharts.publish('regionSelection', null);
  
  if (selectedCountry === countryName) {
      console.log("Deselecting country"); // Debug log
      selectedCountry = null;
      LinkedCharts.publish('countrySelection', null);
  } else {
      console.log("Selecting new country"); // Debug log
      selectedCountry = countryName;
      const countryData = data.find(item => item.country === countryName);
      LinkedCharts.publish('countrySelection', countryData);
  }

  // Update the visualization
  updateChoroplethMap(currentData);
  
  // Reset the flag after handling is complete
  isHandlingCountrySelection = false;
}

    function handleCountrySelectionFromParallel(selection) {
        // Remove this function as it's no longer needed
    }

    function handleRegionHover(region) {
      function getCountriesInRegion(region, data) {
        return [...new Set(data.filter(d => d.region === region).map(d => d.country))];
      }
  
      const hoveredCountriesInRegion = region ? getCountriesInRegion(region, currentData) : [];
      const selectedCountriesInRegion = selectedRegion ? getCountriesInRegion(selectedRegion, currentData) : [];
  
      
      mapGroup.selectAll("path")
        .attr("stroke", d => {
          if (!d || !d.properties) return "#fff";
          
          if (d.properties.name === selectedCountry) {
            return "#8B0000"; // Selected country
          } else if (selectedCountriesInRegion.includes(d.properties.name)) {
            return regionColor || "#8B0000"; // Selected region
          } else if (hoveredCountriesInRegion.includes(d.properties.name)) {
            return "#000"; // Hovered region
          }
          return "#fff"; // Default
        })
        .attr("stroke-width", d => {
          if (!d || !d.properties) return 0.25;
          
          if (d.properties.name === selectedCountry) {
            return 0.75; // Selected country
          } else if (selectedCountriesInRegion.includes(d.properties.name)) {
            return 0.5; // Selected region
          } else if (hoveredCountriesInRegion.includes(d.properties.name)) {
            return 0.5; // Hovered region
          }
          return 0.25; // Default
        });
  
      // Raise hovered countries
      mapGroup.selectAll("path")
        .filter(d => d && d.properties && hoveredCountriesInRegion.includes(d.properties.name))
        .raise();
    }

    function handleRegionSelection(selection) {
      // Only clear country selection if we're not currently handling a country selection
      if (!isHandlingCountrySelection) {
          console.log("Clearing country selection");
          selectedCountry = null;
          LinkedCharts.publish('countrySelection', null);
      }
      
      if (selection && selection.region && selection.color) {
          selectedRegion = selection.region;
          regionColor = selection.color;
      } else {
          selectedRegion = null;
          regionColor = null;
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

    function handleCountryHover(countryName) {
      mapGroup.selectAll("path")
        .attr("stroke", d => {
          if (d.properties && d.properties.name === selectedCountry) return "#8B0000";
          return d.properties && d.properties.name === countryName ? "#000" : "#fff";
        })
        .attr("stroke-width", d => {
          if (d.properties && d.properties.name === selectedCountry) return 0.75;
          return d.properties && d.properties.name === countryName ? 0.5 : 0.25;
        })
        .each(function(d) {
          if (d.properties && d.properties.name === countryName) {
            d3.select(this).raise();
          }
        });
    }

    function zoomToCountry(d, width, height) {
      const bounds = path.bounds(d);
      const dx = bounds[1][0] - bounds[0][0];
      const dy = bounds[1][1] - bounds[0][1];
      const x = (bounds[0][0] + bounds[1][0]) / 2;
      const y = (bounds[0][1] + bounds[1][1]) / 2;
      const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
      const translate = [width / 2 - scale * x, height / 2 - scale * y];

      svg.transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale)
        );
    }

    function resetZoom() {
      svg.transition()
        .duration(750)
        .call(
          zoom.transform,
          initialTransform
        );
    }












