function createChoroplethMap(data, containerId) {
  // Set up dimensions
  const margin = { top: 20, right: 20, bottom: 50, left: 80 };
  const width = window.innerWidth/2;
  const height = 3*(window.innerHeight/7);

  // Data pre-processing
  data.forEach(d => {
    if (d.country === "United States") {
      d.country = "United States of America";
    }
    else if (d.country === "Taiwan Province of China") {
      d.country = "Taiwan";
    }
    else if (d.country === "Dominican Republic") {
      d.country = "Dominican Rep.";
    }
    else if (d.country === "Bosnia and Herzegovina") {
      d.country = "Bosnia and Herz.";
    }
    else if (d.country === "Ivory Coast") {
      d.country = "Côte d'Ivoire";
    }
    else if (d.country === "North Macedonia") {
      d.country = "Macedonia";
    }
    else if (d.country === "Palestinian Territories") {
      d.country = "Palestine";
    }      
  });

  // Create SVG
  const svg = d3.select(containerId)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create a color scale
  const colorScale = d3.scaleQuantile()
    .domain(d3.extent(data, d => +d.happiness_score))
    .range(d3.schemeBlues[9]);

  // Load world map data
  d3.json("./data/countries-50m.json").then(function(worldData) {
    const countries = topojson.feature(worldData, worldData.objects.countries);
  
    // Create a map projection
    const projection = d3.geoMercator()
      .fitSize([width, height], countries)
      .center([-100, 75])
      .scale(600);

    // Create a path generator
    const path = d3.geoPath().projection(projection);

    // Draw the map
    svg.selectAll("path")
      .data(countries.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", d => {
        const countryData = data.find(item => item.country === d.properties.name);
        return countryData ? colorScale(+countryData.happiness_score) : "#ccc";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", function(event, d) {
        const countryData = data.find(item => item.country === d.properties.name);
        if (countryData) {
          d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
          showTooltip(event, d, countryData);
        }
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
        hideTooltip();
      });
    
    // Add zoom functionality
    const zoom = d3.zoom()
      .scaleExtent([0.2, 50])
      .on("zoom", zoomed);

    svg.call(zoom)
      .call(zoom.transform, d3.zoomIdentity.scale(0.2));

    function zoomed(event) {
      svg.selectAll("path")
        .attr("transform", event.transform);
    }

    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 120}, ${height - 180})`);

    const legendScale = d3.scaleLinear()
      .domain(d3.extent(data, d => +d.happiness_score))
      .range([0, 180]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickSize(20);

    legend.selectAll("rect")
      .data(colorScale.range())
      .enter()
      .append("rect")
      .attr("y", (d, i) => i * 20)
      .attr("width", 20)
      .attr("height", 20)
      .style("fill", d => d);

    legend.call(legendAxis);

    legend.append("text")
      .attr("x", 10)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .text("Happiness Score");
  });
  
  // Tooltip functions
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
      Happiness Score: ${countryData.happiness_score}<br>
      GDP per capita: ${countryData.gdp_per_capita}<br>
      Social support: ${countryData.social_support}<br>
      Healthy life expectancy: ${countryData.healthy_life_expectancy}
    `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  }
  
  function hideTooltip() {
    d3.select(".tooltip").remove();
  }
}