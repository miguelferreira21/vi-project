function createChoroplethMap(data, containerId) {
  // Clear previous choropleth map
  d3.select(containerId).selectAll("*").remove();

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

  const averagesArray = Array.from(d3.rollup(
    data, 
    v => ({
      happiness_score: d3.mean(v, d => +d.happiness_score),
      gdp_per_capita: d3.mean(v, d => +d.gdp_per_capita),
      social_support: d3.mean(v, d => +d.social_support),
      healthy_life_expectancy: d3.mean(v, d => +d.healthy_life_expectancy),
    }),
    d => d.country
  )).map(([country, averages]) => ({
    country,
    ...averages
  }));

  // Create SVG
  const svg = d3.select(containerId)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Create a group for the map and transformations
  const mapGroup = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create a color scale
  const colorScale = d3.scaleSequential(d3.interpolateBlues)
    .domain(d3.extent(averagesArray, d => +d.happiness_score));

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
      .attr("fill", d => {
        const countryData = averagesArray.find(item => item.country === d.properties.name);
        return countryData ? colorScale(+countryData.happiness_score) : "#ccc";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.05);

    // Add mouseover and mouseout events
    mapGroup.selectAll("path")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke", "#000").attr("stroke-width", 0.40);
        const countryData = averagesArray.find(item => item.country === d.properties.name);
        if (countryData) {
          showTooltip(event, d, countryData);
        }
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.25);
        hideTooltip();
      });

    const legend = svg.append("g")
      .attr("transform", `translate(${width - 120}, ${height - 180})`);

    const legendWidth = 20;
    const legendHeight = 180;

    const legendScale = d3.scaleLinear()
      .domain(d3.extent(averagesArray, d => +d.happiness_score))
      .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickSize(6);

    legend.append("g")
      .attr("transform", `translate(${legendWidth}, 0)`)
      .call(legendAxis);

    const legendGradient = legend.append("defs")
      .append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    legendGradient.selectAll("stop")
      .data(colorScale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: colorScale(t) })))
      .enter().append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

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
      Happiness Score: ${countryData.happiness_score.toFixed(3)}<br>
      GDP per capita: ${countryData.gdp_per_capita.toFixed(3)}<br>
      Social support: ${countryData.social_support.toFixed(3)}<br>
      Healthy life expectancy: ${countryData.healthy_life_expectancy.toFixed(3)}
    `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  }
  
  function hideTooltip() {
    d3.select(".tooltip").remove();
  }
}