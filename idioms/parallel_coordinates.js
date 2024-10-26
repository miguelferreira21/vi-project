function createParallelCoordinates(initialData, containerId) {
    let data = initialData;
    let cachedLinePaths = new Map();
    
    const keys = Object.keys(data[0]).filter(d => d !== 'country' && d !== 'region' && d !== 'year' && d !== 'population');
    const colorKey = 'population';
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
        'temperature': 'Temperature',
        'fertility_rate': 'Fertility rate'
    };

    const getDisplayName = (key) => columnNameMap[key] || key;
    let displayKeysOrder = keys.filter(key => key !== 'population');

    const margin = { top: 20, right: 150, bottom: 30, left: 12 };
    const container = d3.select(containerId);
    const containerWidth = container.node().clientWidth;
    const containerHeight = container.node().clientHeight;
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    let parallelCoordX = d3.scalePoint().range([0, width]).padding(0.75);
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

    function setup() {
        container.selectAll("*").remove();
        averagedData = calculateAverages(data, keys);
        parallelCoordX.domain(displayKeysOrder);
        
        initializeScales(averagedData);

        const svg = container.append("svg")
            .attr("width", containerWidth)
            .attr("height", containerHeight)
            .style("position", "relative")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const linesGroup = svg.append("g").attr("class", "lines");
        setupAxes(svg);
        setupBrushes(svg);
        setupLegend(svg);
        
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
            .attr("transform", `translate(${width + margin.right - legendWidth * 4.5}, ${height * 0.25})`);

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
            if (key === 'temperature') {
                const validData = data.filter(d => +d[key] !== -999.0);
                y[key] = d3.scaleLinear()
                    .domain([d3.min(validData, d => +d[key]), d3.max(validData, d => +d[key])])
                    .range([height, 0]);
            } else if (key === 'fertility_rate') {
                y[key] = d3.scaleLinear()
                    .domain([0, d3.max(data, d => +d[key])])
                    .range([height, 0]);
            } else {
                const extent = d3.extent(data, d => +d[key]);
                const padding = (extent[1] - extent[0]) * 0.05;
                y[key] = d3.scaleLinear()
                    .domain([extent[0] - padding, extent[1] + padding])
                    .range([height, 0]);
            }
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
        const dataToRender = selectedRegion 
            ? averagedData.filter(d => d.region === hoveredRegion)
            : filteredData;

        const totalPopulation = memoizedTotalPopulation(initialData);
        const color = getColorScale(totalPopulation);
        
        const lines = linesGroup.selectAll("path")
            .data(dataToRender, d => d.region);

        lines.exit().remove();

        const linesEnter = lines.enter()
            .append("path")
            .attr("fill", "none")
            .attr("d", d => linePath(d));

        const allLines = lines.merge(linesEnter)
            .transition()
            .duration(60)
            .attr("d", d => linePath(d))
            .attr("stroke", d => {
                if (selectedRegion && d.region === selectedRegion) {
                    return "#FF0000";
                }
                return color(totalPopulation.get(d.region));
            })
            .attr("stroke-width", d => selectedRegion && d.region === selectedRegion ? 2 : 1.5)
            .attr("opacity", d => 1);

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
                d3.select(this).call(d3.axisLeft().scale(y[d]));
            });

        setupAxisTitles(axes);
    }

    function setupAxisTitles(axes) {
        axes.append("text")
            .attr("class", "axis-title")
            .style("text-anchor", "middle")
            .style("font-size", width * 0.00995)
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
                    .attr("stroke-width", 3)
                    .attr("stroke", "#FF4500");

                // Publish hover event for choropleth map
                LinkedCharts.publish('regionHover', d.region);
                showTooltip(event, d, tooltip);
            })
            .on("mousemove", (event) => {
                updateTooltipPosition(event, tooltip);
            })
            .on("mouseout", (event, d) => {
                hoveredRegion = null;
                resetLineStyle(event.target, d);
                // Clear hover state
                LinkedCharts.publish('regionHover', null);
                hideTooltip(tooltip);
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
            LinkedCharts.publish('regionSelection', { region: d.region, year: d.year });
        }
        drawLines(filteredData, d3.select('.lines'));
    }

    function resetLineStyle(element, d) {
        const totalPopulation = memoizedTotalPopulation(initialData);
        d3.select(element)
            .attr("stroke-width", selectedRegion && d.region === selectedRegion ? 2 : 1.5)
            .attr("stroke", () => {
                if (selectedRegion && d.region === selectedRegion) {
                    return "#FF0000";
                }
                return getColorScale(totalPopulation)(totalPopulation.get(d.region));
            })
            .attr("opacity", () => {
                if (selectedRegion) {
                    return d.region === selectedRegion ? 1 : 0.1;
                }
                return 1; 
            });
    }

    function getColorScale(totalPopulation) {
        const extent = [
            d3.min([...totalPopulation.values()]),
            d3.max([...totalPopulation.values()])
        ];
        return d3.scaleSequential()
            .domain(extent)
            .interpolator(d3.interpolateRgb("#F0E68C", "#FF4500"));
    }

    function calculateTotalPopulationByRegion(data) {
        return d3.rollup(data, 
            v => d3.max(v, d => +d.population), // Take the maximum population for each region
            d => d.region
        );
    }

    function handleYearRangeUpdate(yearRange) {
        const { startYear, endYear, selectedYear } = yearRange;
        const filteredData = initialData.filter(d => {
            const dataYear = parseInt(d.year);
            return selectedYear !== null
                ? dataYear === parseInt(selectedYear)
                : dataYear >= parseInt(startYear) && dataYear <= parseInt(endYear);
        });

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
