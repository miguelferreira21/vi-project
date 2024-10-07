function createLineChart(data, containerId) {
    // Calculate average happiness score for each year
    const averagePerYear = d3.rollup(data,
        v => d3.mean(v, d => d.happiness_score),
        d => d.year
    );

    const averageArray = Array.from(averagePerYear, ([year, happiness_score]) => ({ year, happiness_score }));

    const margin = {top: 50, right: 10, bottom: 50, left: -10};
    const width = window.innerWidth / 2;
    const height = window.innerHeight / 8.5;

    const svg = d3.select(containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(averageArray, d => d.year))
        .range([50, width - 50]);

    const y = d3.scaleLinear()
        .domain([d3.min(averageArray, d => d.happiness_score) - 0.1, d3.max(averageArray, d => d.happiness_score) + 0.1])
        .range([height - 20, 20]);

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.happiness_score));

    // Create a group for the chart
    const chartGroup = svg.append("g")
        .attr("transform", `translate(0, 30)`);



    // Draw the line
    chartGroup.append("path")
        .datum(averageArray)
        .attr("class", "line")
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2);

    const years = averageArray.map(d => d.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // Create a group for the slider
    const sliderGroup = svg.append("g")
        .attr("class", "slider")
        .attr("transform", `translate(0, ${height + 10})`);

    const slider = d3.sliderBottom(x)
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

    // Style the slider to make it more aesthetic
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

    // Add range display under the slider
    const rangeDisplay = sliderGroup.append('text')
        .attr('class', 'range-display')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(${width/2}, 40)`)
        .style('font-size', '14px')
        .style('font-weight', 'bold');

    // Update range display function
    function updateRangeDisplay(startYear, endYear) {
        if (startYear === endYear) {
            rangeDisplay.text(`${startYear}`);
        } else {
            rangeDisplay.text(`${startYear} - ${endYear}`);
        }
    }

    // Initial update of range display
    updateRangeDisplay(minYear, maxYear);

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

    // Trigger an update to ensure proper initialization
    slider.value([minYear, maxYear]);

    let selectedYear = null;

    // Create circles for data points
    chartGroup.selectAll(".dot")
        .data(averageArray)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.happiness_score))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .on("mouseover", function (event, d) {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`Year: ${d.year}<br>Happiness Score: ${d.happiness_score.toFixed(3)}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select("#tooltip")
                .style("opacity", 0);
        })
        .on("click", function(event, d) {
            if (selectedYear === d.year) {
                selectedYear = null;
                updateChart(slider.value()[0], slider.value()[1]);
            } else {
                selectedYear = d.year;
                updateChart(d.year, d.year);
            }
        });

    // Create a tooltip div
    d3.select("body").append("div")
        .attr("id", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "lightsteelblue")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("pointer-events", "none");

    function updateChart(startYear, endYear) {
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

        // Update the displayed range
        d3.select("#yearRange").text(selectedYear !== null ? `${selectedYear}` : `${startYear} - ${endYear}`);

        // Filter data based on the selected range or year
        const filteredData = selectedYear !== null
            ? data.filter(d => d.year == selectedYear)
            : data.filter(d => d.year >= startYear && d.year <= endYear);

        // Update the choropleth map with the filtered data
        createChoroplethMap(filteredData, ".Choropleth");

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
    }

    // Initialize the display
    updateChart(minYear, maxYear);
}