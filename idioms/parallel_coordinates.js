function createParallelCoordinates(initialData, containerId) {
    let data = initialData;
    const keys = Object.keys(data[0]).filter(d => d !== 'country' && d !== 'year' && d !== 'region');
    let currentColorKey = 'happiness_score'; // Default key for color scale

    // Replace names in the chart
    const columnNameMap = {
        'happiness_score': 'Happiness Score',
        'healthy_life_expectancy': 'Healthy Life expectancy',
        'freedom_to_make_life_choices': 'Freedom',
        'perceptions_of_corruption': 'Perception of Corruption',
        'gdp_per_capita': 'GDP per Capita (GK$)',
        'social_support': 'Social Support',
        'generosity': 'Generosity',
        'temperature': 'Temperature',
        'fertility_rate': 'Fertility rate'
    };

    // Function to get the display name for a key
    const getDisplayName = (key) => columnNameMap[key] || key;

    // Update keys to use display names
    const displayKeys = keys.map(getDisplayName);

    const margin = { top: 60, right: 150, bottom: 30, left: 12 };
    const container = d3.select(containerId);
    const containerWidth = container.node().clientWidth * 0.995; // Updated dimensioning
    const containerHeight = container.node().clientHeight * 1.65; // Updated dimensioning
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // Clear the container
    container.selectAll("*").remove();

    // Create SVG for lines, axes, brushes, and legend
    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .style("position", "relative")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
        .range([0, width])
        .padding(0.75)
        .domain(displayKeys);

    const y = {};
    for (let key of keys) {
        if (key === 'temperature') {
            y[key] = d3.scaleLinear()
                .domain([d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]), d3.max(data, d => +d[key])])
                .range([height, 0]);
        } else if (key === 'fertility_rate') {
            y[key] = d3.scaleLinear()
                .domain([0, d3.max(data, d => +d[key])])
                .range([height, 0]);
        } else {
            y[key] = d3.scaleLinear()
                .domain(d3.extent(data, d => +d[key]))
                .range([height, 0]);
        }
    }

    // Function to get the color scale based on the selected attribute
    const getColorScale = (key) => {
        if (key === 'temperature') {
            return d3.scaleSequential(d3.interpolateBrBG)
                .domain([
                    d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]),
                    d3.max(data, d => +d[key])
                ]);
        } else if (key === 'fertility_rate') {
            return d3.scaleSequential(d3.interpolateBrBG)
                .domain([0, d3.max(data, d => +d[key])]);
        } else {
            return d3.scaleSequential(d3.interpolateBrBG)
                .domain(d3.extent(data, d => +d[key]));
        }
    };

    let color = getColorScale(currentColorKey);

    // -------------------
    // **Layer Ordering**
    // -------------------

    // 1. **Lines Group**: Rendered first (behind)
    const linesGroup = svg.append("g")
        .attr("class", "lines");

    // 2. **Axes Group**: Rendered after lines (on top)
    const axes = svg.selectAll(".myAxis")
        .data(keys).enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(getDisplayName(d))},0)`)
        .each(function(d) { d3.select(this).call(d3.axisLeft().scale(y[d])); });

    // Add interactive titles to axes
    axes.append("text")
        .style("text-anchor", "middle")
        .style("font-size", "10.5px")
        .attr("y", height + 20)
        .text(d => getDisplayName(d))
        .style("fill", "black")
        .attr("class", "axis-title")
        .on("mouseover", function() {
            d3.select(this).style("cursor", "pointer").style("font-weight", "bold");
        })
        .on("mouseout", function() {
            if (d3.select(this).attr("data-selected") !== "true") {
                d3.select(this).style("font-weight", "normal");
            }
        })
        .on("click", function(event, d) {
            const isSelected = d3.select(this).attr("data-selected") === "true";
            axes.selectAll(".axis-title")
                .attr("data-selected", "false")
                .style("font-weight", "normal");
            
            if (!isSelected) {
                d3.select(this).attr("data-selected", "true").style("font-weight", "bold");
                updateColorScale(d);
            } else {
                updateColorScale('happiness_score');
            }
        });

    // 3. **Brushes Group**: Rendered after axes (on top)
    const brush = d3.brushY()
        .extent([[-15, 0], [15, height]])
        .on("start brush end", brushed);

    // Apply brush to all axes, including happiness score
    svg.selectAll(".axis")
        .append("g")
        .attr("class", "brush")
        .each(function(d) { d3.select(this).call(brush); });

    var tooltip = container.append("div")
    .attr("class", "tooltip") // For CSS styling
    .style("position", "absolute")
    .style("background", "lightsteelblue")
    .style("padding", "5px")
    .style("border-radius", "5px")
    .style("pointer-events", "none")
    .style("font-family", "Arial")
    .style("font-size", "14px")
    .style("opacity", 0) // Initially hidden
    .style("z-index", 10); // Ensures tooltip is on top

    // Initialize state variables
    let activeBrushes = new Map();
    let brushExtents = new Map();

    // Initialize state variables for hover
    let hoveredData = null;

    // Set to keep track of selected lines via brushing and clicking
    let selectedData = new Set();

    // -------------------
    // **Lines Rendering with Hover and Brush**
    // -------------------
    function drawLines(filteredData) {
        // Bind data with unique identifier
        const lines = linesGroup.selectAll("path")
            .data(data, d => d.country + d.year); // Ensure uniqueness

        // Remove exiting lines
        lines.exit().remove();

        // Add new lines
        const linesEnter = lines.enter()
            .append("path")
            .attr("d", d => linePath(d))
            .attr("stroke", d => color(d[currentColorKey]))
            .attr("stroke-width", 1)
            .attr("fill", "none")
            .attr("opacity", 0.1); // Start with dimmed opacity

        // Merge enter and existing lines
        linesEnter.merge(lines)
            .transition()
            .duration(60)
            .attr("d", d => linePath(d))
            .attr("stroke", d => color(d[currentColorKey]))
            .attr("opacity", d => {
                if (hoveredData && hoveredData === d) {
                    return 1; // Fully opaque for hovered line
                } else if (selectedData.has(d)) {
                    return 1; // Fully opaque for selected lines
                } else {
                    return 0.1; // Dimmed for others
                }
            });

        // Add event listeners for hover interactions
        linesEnter
            .on("mouseover", function(event, d) {
                hoveredData = d;
                d3.select(this)
                    .attr("stroke-width", 3)
                    .attr("stroke", "red"); // Highlight color for hover

                // Show tooltip
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                
                // Define tooltip content (Customize as needed)
                tooltip.html(`
                    <strong>Country:</strong> ${d.country}<br/>
                    <strong>Year:</strong> ${d.year}<br/>
                    <strong>Happiness Score:</strong> ${d.happiness_score}<br/>
                    <!-- Add more fields as necessary -->
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mousemove", function(event, d) {
                // Update tooltip position based on mouse movement
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                hoveredData = null;
                d3.select(this)
                    .attr("stroke-width", 1)
                    .attr("stroke", color(d[currentColorKey]));

                // Hide tooltip
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0);
            });
    }

    function linePath(d) {
        return d3.line()(
            keys.map(key => {
                const value = d[key];
                // Check if the value is valid (not -999 or undefined)
                if (value === -999 || value === undefined) {
                    return [x(getDisplayName(key)), height]; // Place it at the bottom if value is invalid
                }
                return [x(getDisplayName(key)), y[key](value)];
            })
        );
    }

    // Initial draw
    drawLines(data);

    // -------------------
    // **Brush and Selection Handling**
    // -------------------
    function brushed(event, key) {
        const selection = event.selection;
        if (selection) {
            activeBrushes.set(key, selection);
            brushExtents.set(key, selection.map(y[key].invert));
        } else {
            activeBrushes.delete(key);
            brushExtents.delete(key);
        }
        const filteredData = filterData(data);
        selectedData = new Set(filteredData);
        drawLines(filteredData);
        LinkedCharts.publish('parallelCoordinatesFilter', filteredData);
    }

    function filterData(dataToFilter) {
        return dataToFilter.filter(d => {
            for (let [key, brushRange] of brushExtents) {
                const value = +d[key];
                if (value < brushRange[1] || value > brushRange[0]) {
                    return false;
                }
            }
            return true;
        });
    }

    // -------------------
    // **Legend Setup**
    // -------------------
    function createStaticLegend(data, width, height) {
        const extent = d3.extent(data, d => d[currentColorKey]);

        const legendWidth = width * 0.025;
        const legendHeight = height * 0.55;

        const legend = svg.append("g")
            .attr("class", "parallel-coordinates-legend")
            .attr("transform", `translate(${width + margin.right - legendWidth * 4.5}, ${height * 0.25})`);

        // Use the same color scale as the lines
        const legendScale = d3.scaleLinear()
            .domain(extent)
            .range([legendHeight, 0]);

        const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickFormat(d3.format(".2f"));

        // Create gradient using the same color scale as the lines
        const gradient = legend.append("defs")
            .append("linearGradient")
            .attr("id", "parallel-coordinates-legend-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        // Define the color stops for the gradient based on the color scale
        gradient.selectAll("stop")
            .data(d3.range(0, 1.1, 0.1))
            .enter()
            .append("stop")
            .attr("offset", d => d * 100 + "%")
            .attr("stop-color", d => getColorScale(currentColorKey)(d3.quantile(extent, d))); // Use getColorScale

        // Create rectangle for the gradient
        legend.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#parallel-coordinates-legend-gradient)");

        // Add axis to legend
        legend.append("g")
            .attr("transform", `translate(${legendWidth}, 0)`)
            .style("font-size", height * 0.03)
            .call(legendAxis);

        // Add title to legend
        legend.append("text")
            .attr("x", width * 0.01)
            .attr("y", -height * 0.05)
            .attr("text-anchor", "middle")
            .style("font-family", "Arial")
            .style("font-size", height * 0.04)
            .text(getDisplayName(currentColorKey));
    }

    // Initial legend creation
    createStaticLegend(data, width, height);

    // -------------------
    // **Color Scale Update**
    // -------------------
    function updateColorScale(key) {
        currentColorKey = key;
        
        // Update color scale domain based on the selected key
        if (key === 'temperature') {
            color = d3.scaleSequential(d3.interpolateBrBG)
                .domain([
                    d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]),
                    d3.max(data, d => +d[key])
                ]);
        } else if (key === 'fertility_rate') {
            color = d3.scaleSequential(d3.interpolateBrBG)
                .domain([0, d3.max(data, d => +d[key])]);
        } else {
            color = d3.scaleSequential(d3.interpolateBrBG)
                .domain(d3.extent(data, d => +d[key]));
        }

        // Update legend
        svg.selectAll(".parallel-coordinates-legend").remove();
        createStaticLegend(data, width, height);

        drawLines(filterData(data));
    }

    // -------------------
    // **Data Update Handling**
    // -------------------
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);

    function handleYearRangeUpdate(yearRange) {
        const { startYear, endYear, selectedYear } = yearRange;
        const filteredData = initialData.filter(d => {
            const dataYear = parseInt(d.year);
            return selectedYear !== null
                ? dataYear === parseInt(selectedYear)
                : dataYear >= parseInt(startYear) && dataYear <= parseInt(endYear);
        });
        updateParallelCoordinates(filteredData);
    }

    function handleDataUpdate(newData) {
        initialData = newData;
        updateParallelCoordinates(newData);
    }

    function updateParallelCoordinates(updatedData) {
        data = updatedData;
        
        // Update scales
        for (let key of keys) {
            if (key === 'temperature') {
                y[key].domain([
                    d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]),
                    d3.max(data, d => +d[key])
                ]);
            } else if (key === 'fertility_rate') {
                y[key].domain([0, d3.max(data, d => +d[key])]);
            } else {
                y[key].domain(d3.extent(data, d => +d[key]));
            }
        }

        // Update color scale
        color = getColorScale(currentColorKey);

        // Update legend
        svg.selectAll(".parallel-coordinates-legend").remove();
        createStaticLegend(data, width, height);

        // Update axes
        svg.selectAll(".axis")
            .each(function(d) {
                d3.select(this).call(d3.axisLeft().scale(y[d]));
            });

        // Redraw lines
        selectedData = new Set(filterData(data));
        drawLines(filterData(data));
    }
}
