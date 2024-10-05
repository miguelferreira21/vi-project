// Function to create the choropleth map
function createChoroplethMap(data, containerId) {
    // Filter the data to remove entries with missing incomeperperson values
    currentData = globalDataCapita.filter(function (d) {
      return d.incomeperperson != "";
    });
  
  
    // Create a title for the choropleth map
    const chartTitle = d3
      .select("#choroplethTitle")
      .append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .text("Income per person");
  
  
    // Create an SVG element to hold the map
    const svg = d3
      .select("#choropleth")
      .append("svg")
      .attr("width", width)
      .attr("height", height);
  
  
    // Create a group to hold the map elements
    const mapGroup = svg.append("g");
  
  
    // Create a color scale for the incomeperperson values
    const colorScale = d3
      .scaleLog()
      .domain([
        d3.min(currentData, (d) => d.incomeperperson),
        d3.max(currentData, (d) => d.incomeperperson),
      ])
      .range([0, 1]);
  
  
    // Create a projection to convert geo-coordinates to pixel values
    const projection = d3
      .geoMercator()
      .fitSize([width, height], globalDataCountries);
  
  
    // Create a path generator for the map
    const path = d3.geoPath().projection(projection);
  
  
    // Add countries as path elements to the map
    mapGroup
      .selectAll(".country")
      .data(globalDataCountries.features)
      .enter()
      .append("path")
      .attr("class", "country data")
      .attr("d", path)
      .attr("stroke", "black")
      .on("mouseover", handleMouseOver) // Function to handle mouseover event
      .on("mouseout", handleMouseOut)   // Function to handle mouseout event
      .append("title")
      .text((d) => d.properties.name);
  
  
    // Set the fill color of each country based on its incomeperperson value
    currentData.forEach((element) => {
      mapGroup
        .selectAll("path")
        .filter(function (d) {
          return d.properties.name == element.country;
        })
        .attr("fill", d3.interpolateBlues(colorScale(element.incomeperperson)));
    });
  
  
    // Create zoom behavior for the map
    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on("zoom", zoomed);
  
  
    // Apply zoom behavior to the SVG element
    svg.call(zoom);
  
  
    // Function to handle the zoom event
    function zoomed(event) {
      mapGroup.attr("transform", event.transform);
    }
  
  
    // Create a legend for the choropleth map
    const svg2 = d3
      .select("#choroplethLabel")
      .append("svg")
      .attr("width", width * 0.2)
      .attr("height", height);
  
  
    // Create a gradient for the legend color scale
    const defs = svg2.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "colorScaleGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
  
  
    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", d3.interpolateBlues(0));
  
  
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", d3.interpolateBlues(1));
  
  
    // Create the legend rectangle filled with the color scale gradient
    const legend = svg2.append("g").attr("transform", `translate(0, 40)`);
    const legendHeight = height - 40;
    const legendWidth = 20;
  
  
    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#colorScaleGradient)");
  
  
    // Add tick marks and labels to the legend
    for (let index = 0; index <= 1; index += 0.25) {
      legend
        .append("text")
        .attr("x", legendWidth + 5)
        .attr("y", legendHeight * index)
        .text(Math.round(colorScale.invert(index)));
    }
  }
  
  
  