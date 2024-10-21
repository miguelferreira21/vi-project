function createParallelCoordinates(initialData, containerId) {
    let data = initialData;
    console.log(initialData)
    const keys = Object.keys(data[0]).filter(d => d !== 'country' && d !== 'year' && d !== 'region');
    const colorKey = 'population'; // Fixed key for color scale
    let selectedCountry = null; // Variable to store the selected country

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

    // Initialize the order of axes with data key names
    let displayKeysOrder = keys.filter(key => key !== 'population');

    const margin = { top: 20, right: 150, bottom: 30, left: 12 };
    const container = d3.select(containerId);
    const containerWidth = container.node().clientWidth * 0.995; // Updated dimensioning
    const containerHeight = container.node().clientHeight * 1.65; // Updated dimensioning
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    data = calculateAverages(data, keys);

    // Clear the container
    container.selectAll("*").remove();

    // Create SVG for lines, axes, brushes, and legend
    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .style("position", "relative")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Initial X Scale
    let x = d3.scalePoint()
        .range([0, width])
        .padding(0.75)
        .domain(displayKeysOrder);

    // Y Scales
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

    // Function to get the color scale based on the population attribute
    const totalPopulationByRegion = calculateTotalPopulationByRegion(initialData);
    console.log(totalPopulationByRegion);
    const initialPopulationExtent = [
        d3.min([...totalPopulationByRegion.values()]), 
        d3.max([...totalPopulationByRegion.values()])
    ];
    const getColorScale = () => {
        return d3.scaleSequential()
            .domain(initialPopulationExtent)
            .interpolator(d3.interpolateRgb("#F0E68C", "#FF4500")); // Khaki to Dark Orange
    };
    const color = getColorScale();

    // -------------------
    // **Layer Ordering**
    // -------------------

    // 1. **Lines Group**: Rendered first (behind)
    const linesGroup = svg.append("g")
        .attr("class", "lines");

    // 2. **Axes Group**: Rendered after lines (on top)
    const axes = svg.selectAll(".myAxis")
        .data(displayKeysOrder)
        .enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)},0)`)
        .each(function (d) { d3.select(this).call(d3.axisLeft().scale(y[d])); });

    // Add interactive titles to axes
    axes.append("text")
        .attr("class", "axis-title")
        .style("text-anchor", "middle")
        .style("font-size", width * 0.00995)
        .attr("y", height + 20)
        .text(d => getDisplayName(d))
        .style("fill", "black")
        .style("cursor", "move") // Indicate draggable
        .on("mouseover", function () {
            d3.select(this).style("font-weight", "bold");
        })
        .on("mouseout", function () {
            d3.select(this).style("font-weight", "normal");
        });

    // -------------------
    // **Add Drag Behavior for Axis Reordering**
    // -------------------

    // Variables to track dragging state
    let dragging = false;
    let draggedKey = null;
    let initialMouseX = null;
    let initialAxisX = null;

    // Drag Event Handlers
    function dragStarted(event, d) {
        dragging = true;
        draggedKey = d;
        initialMouseX = event.sourceEvent.pageX;
        initialAxisX = x(d);
        d3.select(this).classed("active", true);
    }

    function draggedAxisHandler(event, d) {
        if (!dragging) return;

        let dx = event.sourceEvent.pageX - initialMouseX;
        let newX = initialAxisX + dx;

        // Clamp the newX within the chart area
        newX = Math.max(0, Math.min(width, newX));

        // Update the position of the dragged axis
        d3.select(this.parentNode)
            .attr("transform", `translate(${newX},0)`);

        // Optionally, show the dragged axis on top
    }

    function dragEnded(event, d) {
        if (!dragging) return;
        dragging = false;
        d3.select(this).classed("active", false);

        // Get the final x position of the dragged axis
        const finalTransform = d3.select(this.parentNode).attr("transform");
        const finalX = parseFloat(finalTransform.split("(")[1]);

        // Calculate the step size between axes
        const step = width / (displayKeysOrder.length - 1);

        // Determine the new index based on the final x position
        let newIndex = Math.round(finalX / step);
        newIndex = Math.max(0, Math.min(displayKeysOrder.length - 1, newIndex));

        // Find the current index of the dragged key
        const oldIndex = displayKeysOrder.indexOf(draggedKey);

        if (newIndex !== oldIndex) {
            // Remove the axis from the old position
            displayKeysOrder.splice(oldIndex, 1);
            // Insert it into the new position
            displayKeysOrder.splice(newIndex, 0, draggedKey);
        }

        // Update the x scale domain
        x.domain(displayKeysOrder);

        // Transition axes to new positions
        axes.transition()
            .duration(500)
            .attr("transform", d => `translate(${x(d)},0)`);

        // Transition lines to new positions
        linesGroup.selectAll("path")
            .transition()
            .duration(400)
            .ease(d3.easeCubic)
            .attr("d", d => linePath(d));

        // Reapply brushes
        svg.selectAll(".brush")
            .remove();

        svg.selectAll(".axis")
            .append("g")
            .attr("class", "brush")
            .each(function (d) { d3.select(this).call(brush); });

        // Reset draggedKey
        draggedKey = null;
    }

    const dragBehavior = d3.drag()
        .on("start", dragStarted)
        .on("drag", draggedAxisHandler)
        .on("end", dragEnded);

    // Apply drag behavior to axis titles
    axes.select(".axis-title").call(dragBehavior);

    // 3. **Brushes Group**: Rendered after axes (on top)
    const brush = d3.brushY()
        .extent([[-15, 0], [15, height]])
        .on("start brush end", brushed);

    // Apply brush to all axes, including happiness score
    svg.selectAll(".axis")
        .append("g")
        .attr("class", "brush")
        .each(function (d) { d3.select(this).call(brush); });

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
        const dataToRender = selectedCountry 
            ? data.filter(d => d.country === selectedCountry)
            : filteredData;
    
        // Bind data with unique identifier
        const lines = linesGroup.selectAll("path")
            .data(dataToRender, d => d.country + d.year);
    
        // Remove exiting lines
        lines.exit().remove();
    
        // Add new lines
        const linesEnter = lines.enter()
            .append("path")
            .attr("d", d => linePath(d))
            .attr("fill", "none");
    
        // Merge enter and existing lines
        linesEnter.merge(lines)
            .transition()
            .duration(60)
            .attr("d", d => linePath(d))
            .attr("stroke", d => {
                if (selectedCountry && d.country === selectedCountry) {
                    return "#FF0000"; // Red color for selected country
                }
                const regionPopulation = totalPopulationByRegion.get(d.region);
                return color(regionPopulation);
            })
            .attr("stroke-width", d => selectedCountry && d.country === selectedCountry ? 2 : 1.5) // Increased minimum stroke width
            .attr("opacity", d => {
                if (selectedCountry) {
                    return d.country === selectedCountry ? 1 : 0.2; // Increased minimum opacity
                }
                if (hoveredData && hoveredData === d) {
                    return 1;
                } else if (selectedData.has(d)) {
                    return 1;
                } else {
                    return 0.2; // Increased minimum opacity
                }
            });

        // Add hover interactions
        linesEnter.merge(lines)
            .on("mouseover", function(event, d) {
                hoveredData = d;
                d3.select(this)
                    .attr("stroke-width", 3)
                    .attr("stroke", "#FF4500"); // Orangered for hover

                // Show tooltip
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);

                // Define tooltip content
                tooltip.html(`
                    <strong>${d.country}</strong><br/>
                    Region: ${d.region}<br/>
                    Happiness Score: ${d.happiness_score.toFixed(2)}<br/>
                    Regional Population: ${d.population.toFixed(0)}<br/>
                    <!-- Add more fields as necessary -->
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mousemove", function (event, d) {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                hoveredData = null;
                d3.select(this)
                    .attr("stroke-width", selectedCountry && d.country === selectedCountry ? 2 : 1)
                    .attr("stroke", () => {
                        if (selectedCountry && d.country === selectedCountry) {
                            return "#FF0000"; // Keep selected country red
                        }
                        return color(totalPopulationByRegion.get(d.region));
                    })
                    .attr("opacity", () => {
                        if (selectedCountry) {
                            return d.country === selectedCountry ? 1 : 0.1;
                        }
                        return selectedData.has(d) ? 1 : 0.1;
                    });

                // Hide tooltip
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0);
            })
            .on("click", function(event, d) {
                if (selectedCountry === d.country) {
                    // Deselect the country
                    selectedCountry = null;
                    LinkedCharts.publish('countrySelection', null);
                } else {
                    // Select the country
                    selectedCountry = d.country;
                    LinkedCharts.publish('countrySelection', { country: d.country, year: d.year });
                }
                drawLines(filteredData);
            });
    }

    function linePath(d) {
        return d3.line()(
            displayKeysOrder.map(key => {
                const value = d[key];
                // Check if the value is valid (not -999 or undefined)
                if (value === -999 || value === undefined) {
                    return [x(key), height]; // Place it at the bottom if value is invalid
                }
                // Clamp the value to the scale's range
                const yValue = Math.max(y[key].range()[1], Math.min(y[key].range()[0], y[key](value)));
                return [x(key), yValue];
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
        if (brushExtents.size === 0) return dataToFilter;
        
        return dataToFilter.filter(d => {
            return Array.from(brushExtents).every(([key, brushRange]) => {
                const value = +d[key];
                return value >= brushRange[1] && value <= brushRange[0];
            });
        });
    }

    // -------------------
    // **Legend Setup**
    // -------------------
    function createStaticLegend(data, width, height) {
        // Use the initial population extent for the legend
        const extent = initialPopulationExtent;
    
        const legendWidth = width * 0.025;
        const legendHeight = height * 0.55;
    
        const legend = svg.append("g")
            .attr("class", "parallel-coordinates-legend")
            .attr("transform", `translate(${width + margin.right - legendWidth * 4.5}, ${height * 0.25})`);
    
        // Use the initial population extent for the color scale in the gradient
        const legendScale = d3.scaleLinear()
            .domain(extent)
            .range([legendHeight, 0]);
    
        const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickFormat(d3.format(".0f"));
    
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
            .data(d3.range(0, 1.001, 0.1))
            .enter()
            .append("stop")
            .attr("offset", d => d * 100 + "%")
            .attr("stop-color", d => color(d3.interpolateNumber(extent[0], extent[1])(d)));
    
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
            .text('Population');
    }
    

    // Initial legend creation
    createStaticLegend(data, width, height);

    // -------------------
    // **Data Update Handling**
    // -------------------
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);
    LinkedCharts.subscribe('countrySelection', handleCountrySelection);

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

    function handleCountrySelection(countryData) {
        if (countryData) {
            selectedCountry = countryData.country;
            // Filter data for the selected country
            const countryFilteredData = data.filter(d => d.country === selectedCountry);
            selectedData = new Set(countryFilteredData);
        } else {
            selectedCountry = null;
            // Reset to show all data
            selectedData = new Set(data);
        }
        drawLines(data);
    }

    function updateParallelCoordinates(updatedData) {
        data = calculateAverages(updatedData, keys);
    
        // Update scales
        updateScales(data);

        // Update axes
        svg.selectAll(".axis")
            .each(function (d) {
                d3.select(this).call(d3.axisLeft(y[d]).ticks(5));
            });
    
        // No need to update color scale as it's now static

        // Update legend
        svg.selectAll(".parallel-coordinates-legend").remove();
        createStaticLegend(data, width, height);
    
        // Redraw lines
        selectedData = new Set(filterData(data));
        drawLines(filterData(data));
    }

    function updateScales(data) {
        keys.forEach(key => {
            if (key === 'temperature') {
                y[key].domain([
                    d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]),
                    d3.max(data, d => +d[key])
                ]);
            } else if (key === 'fertility_rate') {
                y[key].domain([0, d3.max(data, d => +d[key])]);
            } else {
                // Extend the domain slightly beyond the data range
                const extent = d3.extent(data, d => +d[key]);
                const padding = (extent[1] - extent[0]) * 0.05; // 5% padding
                y[key].domain([extent[0] - padding, extent[1] + padding]);
            }
        });
    }

    function calculateAverages(data, keys) {
        return Array.from(d3.rollup(data, group => {
            const averages = {};
            // Calculate average for each key except country, year, and region
            keys.forEach(key => {
                const values = group.map(d => +d[key]).filter(value => value !== -999); // Remove invalid values (-999)
                averages[key] = values.length ? d3.mean(values) : -999; // Calculate mean or assign -999 if no valid data
            });
            return {
                country: group[0].country, // Use the country name from the group
                region: group[0].region,
                ...averages
            };
        }, d => d.country)).map(d => d[1]);
    }

    // Function to calculate total population by region
    function calculateTotalPopulationByRegion(data) {
        console.log(data)
        const totalPopulationByRegion = d3.rollup(data, 
            v => d3.sum(v, d => +d.population), // Sum population
            d => d.region // Group by region
        );
        console.log(totalPopulationByRegion)
        // Convert to a Map for easy access
        return new Map(totalPopulationByRegion);
    }
}
