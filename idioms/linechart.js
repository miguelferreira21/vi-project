let lineChartSvg, x, y, line, chartGroup, sliderGroup, slider, rangeDisplay;
let averageArray, minYear, maxYear;
let selectedYear = null;
let previousRange = null;

function createLineChart(data, containerId) {
    // Calculate average happiness score for each year
    const averagePerYear = d3.rollup(data,
        v => d3.mean(v, d => d.happiness_score),
        d => d.year
    );

    averageArray = Array.from(averagePerYear, ([year, happiness_score]) => ({ year, happiness_score }));

    const margin = {top: scaleValue(50), right: scaleValue(10), bottom: scaleValue(50), left: scaleValue(-10)};
    const width = scaleValue(REFERENCE_WIDTH / 2);
    const height = scaleValue(REFERENCE_HEIGHT / 8.5);

    lineChartSvg = d3.select(containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top - scaleValue(25)})`);

    x = d3.scaleLinear()
        .domain(d3.extent(averageArray, d => d.year))
        .range([50, width - 50]);

    y = d3.scaleLinear()
        .domain([d3.min(averageArray, d => d.happiness_score) - 0.1, d3.max(averageArray, d => d.happiness_score) + 0.1])
        .range([height - 20, 20]);

    line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.happiness_score));

    // Create a group for the chart
    chartGroup = lineChartSvg.append("g")
        .attr("transform", `translate(0, 30)`);

    // Draw the line
    chartGroup.append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2);

    const years = averageArray.map(d => d.year);
    minYear = Math.min(...years);
    maxYear = Math.max(...years);

    // Create a group for the slider
    sliderGroup = lineChartSvg.append("g")
        .attr("class", "slider")
        .attr("transform", `translate(0, ${height + 10})`);

    slider = d3.sliderBottom(x)
        .step(1)
        .ticks(8)
        .default([minYear, maxYear])
        .fill('#2196f3')
        .handle(d3.symbol().type(d3.symbolCircle).size(200)())
        .on('onchange', val => {
            const [startYear, endYear] = val.map(Math.round);
            if (startYear !== endYear) {
                selectedYear = null;
            }
            updateChart(startYear, endYear);
        });

    sliderGroup.call(slider);

    // Style the slider
    styleSlider();

    // Add range display under the slider
    rangeDisplay = sliderGroup.append('text')
        .attr('class', 'range-display')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(${width/2}, 40)`)
        .style('font-size', '14px')
        .style('font-weight', 'bold');

    // Create circles for data points
    chartGroup.selectAll(".dot")
        .data(averageArray)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.happiness_score))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleClick);

    // Create a tooltip div
    d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "lightsteelblue")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("pointer-events", "none");

    // Initial update
    updateChart(minYear, maxYear);

    // Subscribe to updates
    LinkedCharts.subscribe('dataUpdate', updateLineChart);
}

function updateLineChartSize() {
    const margin = {top: scaleValue(50), right: scaleValue(10), bottom: scaleValue(50), left: scaleValue(-10)};
    const width = scaleValue(REFERENCE_WIDTH / 2);
    const height = scaleValue(REFERENCE_HEIGHT / 8.5);

    lineChartSvg
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    x.range([scaleValue(50), width - scaleValue(50)]);
    y.range([height - scaleValue(20), scaleValue(20)]);

    chartGroup.select(".line").attr("d", line);
    chartGroup.selectAll(".dot")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.happiness_score))
        .attr("r", scaleValue(4));

    sliderGroup.attr("transform", `translate(0, ${height + scaleValue(10)})`);
    slider.width(width - scaleValue(100));

    rangeDisplay.attr('transform', `translate(${width/2}, ${scaleValue(40)})`);

    // Trigger an update to refresh the chart
    updateChart(slider.value()[0], slider.value()[1]);
}


function updateLineChart(data) {
    // Recalculate averageArray with new data
    const averagePerYear = d3.rollup(data,
        v => d3.mean(v, d => d.happiness_score),
        d => d.year
    );
    averageArray = Array.from(averagePerYear, ([year, happiness_score]) => ({ year, happiness_score }));

    // Update scales
    x.domain(d3.extent(averageArray, d => d.year));
    y.domain([d3.min(averageArray, d => d.happiness_score) - 0.1, d3.max(averageArray, d => d.happiness_score) + 0.1]);

    // Update line
    chartGroup.select(".line")
        .datum(averageArray)
        .attr("d", line);

    // Update dots
    const dots = chartGroup.selectAll(".dot")
        .data(averageArray);

    dots.enter()
        .append("circle")
        .attr("class", "dot")
        .merge(dots)
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.happiness_score))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleClick);

    dots.exit().remove();

    // Update slider
    const years = averageArray.map(d => d.year);
    minYear = Math.min(...years);
    maxYear = Math.max(...years);
    slider.domain([minYear, maxYear]);

    // Trigger an update to ensure proper initialization
    updateChart(minYear, maxYear);
}

function updateChart(startYear, endYear) {
        // Store the previous range when selecting a single year
        if (selectedYear === null && startYear !== endYear) {
           previousRange = [startYear, endYear];
        }
    
        // Check if we're transitioning from a single year to a range
        if (selectedYear !== null && startYear !== endYear) {
            selectedYear = null;
        }
    
        // Update range display
        if (selectedYear !== null) {
            updateRangeDisplay(selectedYear, selectedYear);
        } else {
            updateRangeDisplay(startYear, endYear);
        }
    
        // Update line
        chartGroup.select(".line")
            .datum(averageArray.filter(d => d.year >= startYear && d.year <= endYear))
            .attr("d", line);
    
        // Update dots
        chartGroup.selectAll(".dot")
            .attr("fill", d => {
                if (selectedYear !== null) {
                    return d.year == selectedYear ? "red" : "steelblue";
                } else {
                    return (d.year >= startYear && d.year <= endYear) ? "steelblue" : "#ccc";
                }
            })
            .attr("r", d => {
                if (selectedYear !== null) {
                    return d.year == selectedYear ? 6 : 4;
                } else {
                    return (d.year >= startYear && d.year <= endYear) ? 4 : 3;
                }
            });
    
        // Update slider
        slider.silentValue([startYear, endYear]);
    
        // Notify other charts about the change
        LinkedCharts.publish('yearRange', { 
            startYear: parseInt(startYear), 
            endYear: parseInt(endYear), 
            selectedYear: selectedYear !== null ? parseInt(selectedYear) : null 
        });
    }

function updateRangeDisplay(startYear, endYear) {
    if (startYear === endYear) {
        rangeDisplay.text(`${startYear}`);
    } else {
        rangeDisplay.text(`${startYear} - ${endYear}`);
    }
}

function handleMouseOver(event, d) {
    d3.select("#tooltip")
        .style("opacity", 1)
        .html(`Year: ${d.year}<br>Happiness Score: ${d.happiness_score.toFixed(3)}`)
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
}

function handleMouseOut() {
    d3.select("#tooltip")
        .style("opacity", 0);
}

function handleClick(event, d) {
    if (selectedYear === d.year) {
        selectedYear = null;
        if (previousRange) {
            updateChart(previousRange[0], previousRange[1]);
        } else {
            updateChart(minYear, maxYear);
        }
    } else {
        selectedYear = d.year;
        updateChart(d.year, d.year);
}
}

function styleSlider() {
    sliderGroup.select('.track')
        .attr('stroke', '#ddd')
        .attr('stroke-width', 8)
        .attr('stroke-linecap', 'round');

    sliderGroup.select('.track-inset')
        .attr('stroke', '#eee')
        .attr('stroke-width', 6)
        .attr('stroke-linecap', 'round');

    sliderGroup.select('.track-overlay')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 40)
        .attr('cursor', 'crosshair');

    sliderGroup.selectAll('.tick text')
        .attr('dy', '2em')
        .style('font-size', '12px')
        .style('color', '#666');

    // Remove number display from buttons
    sliderGroup.selectAll('.parameter-value text').remove();

    // Ensure integer display
    sliderGroup.selectAll('.parameter-value text, .tick text')
        .text(function(d) {
            return Math.round(d);
        });

    // Reduce the size of the slider
    sliderGroup.selectAll('.parameter-value')
        .attr('transform', 'scale(0.8)');
    sliderGroup.selectAll('.track, .track-inset, .track-overlay')
        .attr('transform', 'scale(1, 0.8)');
}
