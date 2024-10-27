function createParallelCoordinates(initialData, containerId) {
    let data = initialData;
    let cachedLinePaths = new Map();
    
    const keys = Object.keys(data[0]).filter(d => d !== 'country' && d !== 'region' && d !== 'year' && d !== 'population');
    let selectedRegion = null;
    let hoveredRegion = null;
    let averagedData = null;
    let currentTooltip = null;

    const columnNameMap = {
        'happiness_score': 'Happiness Score',
        'healthy_life_expectancy': 'Healthy Life expectancy',
        'freedom_to_make_life_choices': 'Freedom',
        'perceptions_of_corruption': 'Perception of Corruption',
        'gdp_per_capita': 'GDP per Capita (GK$)',
        'social_support': 'Social Support',
        'generosity': 'Generosity',
        'temperature': 'Temperature (ºC)',
        'fertility_rate': 'Fertility rate'
    };

    const getDisplayName = (key) => columnNameMap[key] || key;
    let displayKeysOrder = keys.filter(key => key !== 'population');

    const container = d3.select(containerId);
    const containerWidth = container.node().clientWidth;
    const containerHeight = container.node().clientHeight;
    const width = containerWidth*0.90;
    const height = containerHeight*0.85;

    let parallelCoordX = d3.scalePoint().range([0, width]);
    const y = {};
    let activeBrushes = new Map();
    let brushExtents = new Map();
    let hoveredData = null;
    let selectedData = new Set();

    const memoizedTotalPopulation = (() => {
        let cache = null;
        return (data) => {
            if (!cache) {
                cache = calculateTotalPopulationByRegion(data);
            }
            return cache;
        };
    })();

    // Add this variable at the top of your createParallelCoordinates function
    let initialDisplayKeysOrder;
    let userCustomOrder; // New variable to store user's custom order

    function setup() {
        container.selectAll("*").remove();
        averagedData = calculateAverages(data, keys);
        
        // Set the initial display order only if it hasn't been set before
        if (!initialDisplayKeysOrder) {
            initialDisplayKeysOrder = keys.filter(key => key !== 'population');
            
            // Modify the initialDisplayKeysOrder array to switch the positions
            const freedomIndex = initialDisplayKeysOrder.indexOf('freedom_to_make_life_choices');
            const corruptionIndex = initialDisplayKeysOrder.indexOf('perceptions_of_corruption');
            if (freedomIndex !== -1 && corruptionIndex !== -1) {
                [initialDisplayKeysOrder[freedomIndex], initialDisplayKeysOrder[corruptionIndex]] = 
                [initialDisplayKeysOrder[corruptionIndex], initialDisplayKeysOrder[freedomIndex]];
            }
        }
        
        // Use userCustomOrder if it exists, otherwise use initialDisplayKeysOrder
        displayKeysOrder = userCustomOrder || [...initialDisplayKeysOrder];

        parallelCoordX.domain(displayKeysOrder);
    
        initializeScales(averagedData);
    
        const svg = container.append("svg")
            .attr("width", containerWidth)
            .attr("height", containerHeight)
            .style("position", "relative");
    
        const horizontalOffset = (containerWidth - width) / 2; // Calculate horizontal centering offset
        const verticalOffset = (containerHeight - height) / 3;

        const svgGroup = svg.append("g")
            .attr("transform", `translate(${horizontalOffset},${verticalOffset})`);
    
        const linesGroup = svgGroup.append("g").attr("class", "lines");
        setupAxes(svgGroup);
        setupBrushes(svgGroup);
    
        drawLines(averagedData, linesGroup);
    
        return { svg, linesGroup };
    }

    function setupLegend(svg) {
        const totalPopulation = memoizedTotalPopulation(data);
        const extent = [
            d3.min([...totalPopulation.values()]),
            d3.max([...totalPopulation.values()])
        ];

        const legendWidth = width * 0.025;
        const legendHeight = height * 0.55;

        const legend = svg.append("g")
            .attr("class", "parallel-coordinates-legend")
            .attr("transform", `translate(${width - legendWidth * 4.5}, ${height * 0.25})`);

        const legendScale = d3.scaleLinear()
            .domain(extent)
            .range([legendHeight, 0]);

        const legendAxis = d3.axisRight(legendScale)
            .tickValues([extent[0], ...d3.ticks(extent[0], extent[1], 3), extent[1]])
            .tickFormat(d => {
                if (d >= 1e9) {
                    return `${d3.format(".1f")(d / 1e9)}B`;
                } else if (d >= 1e6) {
                    return `${d3.format(".1f")(d / 1e6)}M`;
                } else if (d >= 1e3) {
                    return `${d3.format(".1f")(d / 1e3)}K`;
                } else {
                    return d3.format(".0f")(d);
                }
            });

        const gradient = legend.append("defs")
            .append("linearGradient")
            .attr("id", "parallel-coordinates-legend-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        gradient.selectAll("stop")
            .data(d3.range(0, 1.001, 0.1))
            .enter()
            .append("stop")
            .attr("offset", d => d * 100 + "%")
            .attr("stop-color", d => getColorScale(totalPopulation)(d3.interpolateNumber(extent[0], extent[1])(d)));

        legend.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#parallel-coordinates-legend-gradient)");

        legend.append("g")
            .attr("transform", `translate(${legendWidth}, 0)`)
            .style("font-size", height * 0.025)
            .call(legendAxis);

        legend.append("text")
            .attr("x", width * 0.01)
            .attr("y", -height * 0.05)
            .attr("text-anchor", "middle")
            .style("font-family", "Arial")
            .style("font-size", height * 0.04)
            .text('Population');
    }

    function initializeScales(data) {
        keys.forEach(key => {
            let extent;
            if (key === 'temperature') {
                const validData = data.filter(d => +d[key] !== -999.0);
                extent = d3.extent(validData, d => +d[key]);
            } else if (key === 'fertility_rate') {
                extent = [0, d3.max(data, d => +d[key])];
            } else {
                extent = d3.extent(data, d => +d[key]);
                // Ensure minimum is not negative for non-temperature attributes
                extent[0] = Math.max(0, extent[0]);
            }

            // Add padding to the extent
            const padding = (extent[1] - extent[0]) * 0.05;
            const paddedExtent = [extent[0] - padding, extent[1] + padding];

            // Ensure the lower bound is not negative for non-temperature attributes
            if (key !== 'temperature') {
                paddedExtent[0] = Math.max(0, paddedExtent[0]);
            }

            y[key] = d3.scaleLinear()
                .domain(paddedExtent)
                .range([height, 0])
                .nice(); // This will round the domain to nice values
        });
    }

    function linePath(d) {
        const cacheKey = `${d.region}-${JSON.stringify(displayKeysOrder)}`;
        if (cachedLinePaths.has(cacheKey)) {
            return cachedLinePaths.get(cacheKey);
        }

        const path = d3.line()(
            displayKeysOrder.map(key => {
                const value = d[key];
                if (value === -999 || value === undefined) {
                    return [parallelCoordX(key), height];
                }
                const yValue = Math.max(y[key].range()[1], 
                    Math.min(y[key].range()[0], y[key](value)));
                return [parallelCoordX(key), yValue];
            })
        );

        cachedLinePaths.set(cacheKey, path);
        return path;
    }

    function drawLines(filteredData, linesGroup) {
        const dataToRender = filteredData;
    
        // Get the color scale based on region
        const colorScale = getRegionColorScale(initialData);
        
        const lines = linesGroup.selectAll("path")
            .data(dataToRender, d => d.region);

        lines.exit()
            .transition()
            .duration(150)
            .attr("opacity", 0)
            .remove();

        const linesEnter = lines.enter()
            .append("path")
            .attr("fill", "none")
            .attr("d", d => linePath(d))
            .attr("opacity", 0);

        const allLines = lines.merge(linesEnter)
            .transition()
            .duration(130)
            .attr("d", d => linePath(d))
            .attr("stroke", d => colorScale.get(d.region)) // Use region-specific color
            .attr("stroke-width", d => selectedRegion && d.region === selectedRegion ? 4 : 1.5)
            .attr("opacity", d => selectedRegion ? (d.region === selectedRegion ? 1 : 0.5) : 1);
    
        setupLineInteractions(linesEnter.merge(lines), filteredData);
    }

    function brushed(event, key) {
        const selection = event.selection;
        if (selection) {
            activeBrushes.set(key, selection);
            brushExtents.set(key, selection.map(y[key].invert));
        } else {
            activeBrushes.delete(key);
            brushExtents.delete(key);
        }

        // Deselect any selected region when brushing is applied
        selectedRegion = null;
        LinkedCharts.publish('regionSelection', null);

        const filteredDataForDraw = filterData(averagedData);
        const filteredData = filterData(data);
        selectedData = new Set(filteredData);
        drawLines(filteredDataForDraw, d3.select('.lines'));
        
        // Get the unique regions from the filtered data
        const visibleRegions = [...new Set(filteredDataForDraw.map(d => d.region))];
        
        // Publish filtered data to other charts, but only for visible regions
        if (filteredData.length > 0) {
            const visibleFilteredData = filteredData.filter(d => visibleRegions.includes(d.region));
            LinkedCharts.publish('parallelCoordinatesFilter', visibleFilteredData);
        } else {
            LinkedCharts.publish('parallelCoordinatesFilter', data);
        }
    }

    function filterData(dataToFilter) {
        if (brushExtents.size === 0) return dataToFilter;
        
        const brushEntries = Array.from(brushExtents.entries());
        return dataToFilter.filter(d => 
            brushEntries.every(([key, [min, max]]) => {
                const value = +d[key];
                return value >= Math.min(min, max) && value <= Math.max(min, max);
            })
        );
    }

    function calculateAverages(data, keys) {
        // Group by region instead of country
        const groupedData = d3.group(data, d => d.region);
        return Array.from(groupedData, ([region, group]) => {
            const result = { 
                region: region,
                population: d3.sum(group, d => +d.population)
            };
            keys.forEach(key => {
                const values = group.map(d => +d[key]).filter(value => value !== -999);
                result[key] = values.length ? d3.mean(values) : -999;
            });
            return result;
        });
    }

    function setupAxes(svg) {
        const axes = svg.selectAll(".myAxis")
            .data(displayKeysOrder)
            .enter()
            .append("g")
            .attr("class", "axis")
            .attr("transform", d => `translate(${parallelCoordX(d)},0)`)
            .each(function(d) { 
                const scale = y[d];
                const domain = scale.domain();
                const ticks = scale.ticks(5); // Get 5 suggested tick values
                
                // Ensure the first and last ticks are always the domain boundaries
                if (ticks[0] > domain[0]) ticks.unshift(domain[0]);
                if (ticks[ticks.length - 1] < domain[1]) ticks.push(domain[1]);
                
                d3.select(this).call(d3.axisLeft(scale).tickValues(ticks));
            });

        setupAxisTitles(axes);
    }

    function setupAxisTitles(axes) {
        axes.append("text")
            .attr("class", "axis-title")
            .style("text-anchor", "middle")
            .style("font-size", width * 0.012)
            .attr("y", height + 20)
            .text(d => getDisplayName(d))
            .style("fill", "black")
            .style("cursor", "move")
            .call(setupDragBehavior());
    }

    function setupDragBehavior() {
        let dragging = false;
        let draggedKey = null;
        let initialMouseX = null;
        let initialAxisX = null;
    
        return d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded);
    
        function dragStarted(event, d) {
            dragging = true;
            draggedKey = d;
            initialMouseX = event.sourceEvent.pageX;
            initialAxisX = parallelCoordX(d);
            d3.select(this).classed("active", true);
        }
    
        function dragged(event, d) {
            if (!dragging) return;
            let dx = event.sourceEvent.pageX - initialMouseX;
            let newX = Math.max(0, Math.min(width, initialAxisX + dx));
            d3.select(this.parentNode)
                .attr("transform", `translate(${newX},0)`);
        }
    
        function dragEnded(event, d) {
            if (!dragging) return;
            dragging = false;
            d3.select(this).classed("active", false);
    
            const finalTransform = d3.select(this.parentNode).attr("transform");
            const finalX = parseFloat(finalTransform.split("(")[1]);
            const step = width / (displayKeysOrder.length - 1);
            let newIndex = Math.round(finalX / step);
            newIndex = Math.max(0, Math.min(displayKeysOrder.length - 1, newIndex));
    
            const oldIndex = displayKeysOrder.indexOf(draggedKey);
            if (newIndex !== oldIndex) {
                // Update the display order
                displayKeysOrder.splice(oldIndex, 1);
                displayKeysOrder.splice(newIndex, 0, draggedKey);
                parallelCoordX.domain(displayKeysOrder);
                cachedLinePaths.clear();
    
                // Update userCustomOrder to reflect the new order
                userCustomOrder = [...displayKeysOrder];
    
                // Use a requestAnimationFrame to ensure DOM updates are synchronized
                requestAnimationFrame(() => {
                    // Update all axes positions and their titles together
                    const axes = d3.selectAll(".axis")
                        .transition()
                        .duration(500)
                        .attr("transform", d => `translate(${parallelCoordX(d)},0)`);

                    // Update lines
                    d3.select('.lines')
                        .selectAll("path")
                        .transition()
                        .duration(150)
                        .attr("d", d => linePath(d));
                });
            }
            draggedKey = null;
        }
    }

    function setupBrushes(svg) {
        const brush = d3.brushY()
            .extent([[-10, 0], [10, height]])
            .on("start brush end", brushed);

        svg.selectAll(".axis")
            .append("g")
            .attr("class", "brush")
            .each(function(d) { 
                d3.select(this).call(brush);
            });
    }

    function setupLineInteractions(lines, filteredData) {
        const tooltip = setupTooltip();
    
        lines
            .on("mouseover", (event, d) => {
                hoveredRegion = d.region;
                d3.select(event.target)
                    .attr("stroke-width", 4)
                    .attr("opacity", 1); // Full opacity on hover

                LinkedCharts.publish('regionHover', d.region);
    
                // Show the tooltip with region-specific data
                showTooltip(event, d, tooltip);
            })
            .on("mousemove", (event) => {
                updateTooltipPosition(event, tooltip);
            })
            .on("mouseout", (event, d) => {
                hoveredRegion = null;
                resetLineStyle(event.target, d);
                LinkedCharts.publish('regionHover', null);
                hideTooltip(tooltip); // Hide the tooltip when mouse leaves
            })
            .on("click", (event, d) => {
                if (currentTooltip) {
                    currentTooltip.remove();
                    currentTooltip = null;
                }
                handleLineClick(d, filteredData);
            });
    } 

    function setupTooltip() {
        if (currentTooltip) {
            currentTooltip.remove();
        }
        currentTooltip = container.append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "lightsteelblue")
            .style("padding", "5px")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .style("opacity", 0)
            .style("z-index", 10);
        return currentTooltip;
    }

    function showTooltip(event, d, tooltip) {
        tooltip.transition()
            .duration(200)
            .style("opacity", 0.9);
        
        tooltip.html(createTooltipContent(d))
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    }

    function updateTooltipPosition(event, tooltip) {
        tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip(tooltip) {
        tooltip.transition()
            .duration(200)
            .style("opacity", 0);
    }

    function handleLineClick(d, filteredData) {
        if (selectedRegion === d.region) {
            selectedRegion = null;
            LinkedCharts.publish('regionSelection', null);
        } else {
            selectedRegion = d.region;
            LinkedCharts.publish('regionSelection', { region: d.region, year: d.year, color: getRegionColorScale(initialData).get(d.region) });
        }
        drawLines(filteredData, d3.select('.lines'));
    }

    function resetLineStyle(element, d) {
        const colorScale = getRegionColorScale(initialData);  // Get color scale for regions
    
        d3.select(element)
            .attr("stroke-width", selectedRegion && d.region === selectedRegion ? 4 : 1.5)
            .attr("stroke", () => colorScale.get(d.region))  // Use region-specific color
            .attr("opacity", () => {
                if (selectedRegion) {
                    return d.region === selectedRegion ? 1 : 0.5;
                }
                return 1;
            });
    }

    function calculateTotalPopulationByRegion(data) {
        return d3.rollup(data, 
            v => d3.max(v, d => +d.population), // Take the maximum population for each region
            d => d.region
        );
    }

    function getRegionColorScale(data) {
        // Define a list of non-standard colors
        const colorPalette = [
            "#6A0DAD", // Purple//
            "#FFA500", // Orange//
            "#2A9D8F", // Teal//
            "#D6277B", // Magenta//
            "#FFC300", // Mustard yellow//
            "#89992C", // Goldenrod
            "#FF1493", // Deep Pink
            "#996DB3", // Blue Violet
            "#A52A2A"  // Brown
        ];
    
        // Map each unique region to a color
        const regions = Array.from(new Set(data.map(d => d.region)));
        const colorScale = new Map();
        regions.forEach((region, i) => {
            colorScale.set(region, colorPalette[i % colorPalette.length]);
        });
        
        return colorScale;
    }
    

    function handleYearRangeUpdate(yearRange) {
        const { startYear, endYear, selectedYear } = yearRange;
        const filteredData = initialData.filter(d => {
            const dataYear = parseInt(d.year);
            return selectedYear !== null
                ? dataYear === parseInt(selectedYear)
                : dataYear >= parseInt(startYear) && dataYear <= parseInt(endYear);
        });

        // Reset displayKeysOrder to the initial order before updating
        displayKeysOrder = [...initialDisplayKeysOrder];
        
        updateVisualization(filteredData);
    }

    function handleDataUpdate(newData) {
        initialData = newData;
        updateVisualization(newData);
    }

    function handleCountrySelection(regionData) {
        if (regionData) {
            selectedRegion = regionData.region;
            selectedData = new Set(averagedData.filter(d => d.region === selectedRegion));
        } else {
            selectedRegion = null;
            selectedData = new Set(averagedData);
        }
        drawLines(averagedData, d3.select('.lines'));
    }

    function updateVisualization(updatedData) {
        data = updatedData;
        cachedLinePaths.clear();
        averagedData = calculateAverages(data, keys);
        
        // Use userCustomOrder if it exists, otherwise use initialDisplayKeysOrder
        displayKeysOrder = userCustomOrder || [...initialDisplayKeysOrder];
        
        parallelCoordX.domain(displayKeysOrder);
        
        // Reinitialize scales with the updated data
        initializeScales(data);
        
        const { svg, linesGroup } = setup();
        drawLines(averagedData, linesGroup);
    }

    function createTooltipContent(d) {
        const totalPopulation = memoizedTotalPopulation(data);
        const regionPopulation = totalPopulation.get(d.region);
        
        let content = `<strong>${d.region}</strong><br>`;
        content += `Regional Population: ${formatPopulation(regionPopulation)}<br>`;
        content += `Happiness Score: ${d3.format(".2f")(d.happiness_score)}<br>`;
        
        
        return content;
    }

    function formatPopulation(value) {
        if (!value || isNaN(value)) return 'N/A';
        if (value >= 1e9) {
            return `${d3.format(".2f")(value / 1e9)} billion`;
        } else if (value >= 1e6) {
            return `${d3.format(".2f")(value / 1e6)} million`;
        } else if (value >= 1e3) {
            return `${d3.format(".2f")(value / 1e3)} thousand`;
        } else {
            return d3.format(",")(value);
        }
    }

    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);
    LinkedCharts.subscribe('regionSelection', handleCountrySelection);

    const { svg, linesGroup } = setup();
}
