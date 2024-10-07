function createLineChart(data, containerId) {
    // Calculate average happiness score for each year
    const averagePerYear = d3.rollup(data,
        v => d3.mean(v, d => d.happiness_score), // Calculate the average happiness score
        d => d.year // Group by year
    );

    // Convert to array of objects for D3
    const averageArray = Array.from(averagePerYear, ([year, happiness_score]) => ({ year, happiness_score }));

    const width = window.innerWidth / 2;
    const height = window.innerHeight / 7;

    const svg = d3.select(containerId)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const x = d3.scaleLinear()
        .domain(d3.extent(averageArray, d => d.year))
        .range([50, width - 50]);

    const y = d3.scaleLinear()
        .domain([d3.min(averageArray, d => d.happiness_score) - 0.1, d3.max(averageArray, d => d.happiness_score) + 0.1])
        .range([height - 20, 20]); // Reverse Y scale for correct orientation

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.happiness_score));

    const g = svg.append("g");

    // X-axis
    g.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0, ${height - 20})`)
        .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));

    // Draw the line
    g.append("path")
        .datum(averageArray)
        .attr("class", "line")
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2);

    // Create circles for data points
    g.selectAll(".dot")
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

    // Slider event listeners
    const startYearInput = document.getElementById('startYear');
    const endYearInput = document.getElementById('endYear');
    const yearRangeDisplay = d3.select("#yearRange");

    function updateChart() {
        const startYear = parseInt(startYearInput.value);
        const endYear = parseInt(endYearInput.value);

        // Update the displayed range
        yearRangeDisplay.text(`${startYear} - ${endYear}`);

        // Filter data based on the selected range
        const filteredData = data.filter(d => d.year >= startYear && d.year <= endYear);

        // Update the choropleth map with the filtered data
        createChoroplethMap(filteredData, ".Choropleth");
    }

    // Add event listeners for the sliders
    startYearInput.addEventListener('input', function () {
        const startValue = parseInt(startYearInput.value);
        const endValue = parseInt(endYearInput.value);

        // Prevent start year from being greater than end year
        if (startValue >= endValue) {
            startYearInput.value = endValue - 1; // Adjust start year if necessary
        }
        updateChart();
    });

    endYearInput.addEventListener('input', function () {
        const startValue = parseInt(startYearInput.value);
        const endValue = parseInt(endYearInput.value);

        // Prevent end year from being less than start year
        if (endValue <= startValue) {
            endYearInput.value = startValue + 1; // Adjust end year if necessary
        }
        updateChart();
    });

    // Initialize the display
    updateChart();
}