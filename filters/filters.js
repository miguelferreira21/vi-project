let filteredData;
let currentRegionIndex = 0;
let regions = [];

function createFilters(data, containerId) {
    // Set up the dimensions
    const margin = { top: 20, right: 0, bottom: 50, left: 0 };
    const width = window.innerWidth/2;
    const height = window.innerHeight / 8.5;
    const lineThickness = 2;

    // convert values to numbers
    data.forEach(d => {
        d.temperature = +d.temperature;
        d.fertility_rate = +d.fertility_rate;
    })

    // Get unique regions and add 'All' at the beginning
    regions = ['All', ...new Set(data.map(d => d.region))];

    const minTemp = d3.min(data, d => d.temperature);
    const maxTemp = d3.max(data, d => d.temperature);
    const minFert = 0
    const maxFert = d3.max(data, d => d.fertility_rate);

    // Data for three bars
    const filtersData = [
        { id: 1, value: 50, title: 'Top happiest countries (%)', start: 0, finish: 100},
        { id: 2, value: 50, title: 'Temperature (°C)', start: minTemp, finish: maxTemp},
        { id: 3, value: 50, title: 'Fertility rate', start : minFert, finish: maxFert }
    ];

    // Select the container
    const container = d3.select(containerId)
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', '10px'); // Space between each bar

    // Create a region filter at the top
    const regionFilter = container.append('div')
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('align-items', 'center')
        .style('gap', '10px')
        .style('margin-bottom', '10px');

    regionFilter.append('button')
        .text('<')
        .on('click', () => switchRegion(-1));

    const regionText = regionFilter.append('span')
        .text(regions[currentRegionIndex])
        .style('font-size', '16px')
        .style('font-weight', 'bold');

    regionFilter.append('button')
        .text('>')
        .on('click', () => switchRegion(1));

    function switchRegion(direction) {
        // Update the current region index based on direction (-1 for left, 1 for right)
        currentRegionIndex = (currentRegionIndex + direction + regions.length) % regions.length;
        regionText.text(regions[currentRegionIndex]);
        filterData(); // Update the filtered data based on the new region
    }

    function filterData() {
        const selectedRegion = regions[currentRegionIndex];

        if (selectedRegion === 'All') {
            filteredData = data;
        } else {
            filteredData = data.filter(d => d.region === selectedRegion);
        }

        // Update the charts with the new filtered data
        LinkedCharts.publish('dataUpdate', filteredData);
    }

    // Create SVG elements for each bar
    filtersData.forEach(filter => {
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height)
            .style('background', '#f0f0f0');

        // Create a title above each bar
        svg.append('text')
            .attr('x', width / 2 + margin.left)
            .attr('y', margin.top)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('fill', '#333')
            .text(filter.title);

        // Create a group element to hold the bar and slider
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${height / 2})`);

        // Create a thin line as the slider track
        g.append('line')
            .attr('x1', width * 0.2)
            .attr('x2', width * 0.8)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', '#ddd')
            .attr('stroke-width', lineThickness);

        // Add labels for 0 and 100
        g.append('text')
            .attr('x', width * 0.2 - 10) // A bit to the left of the start of the line
            .attr('y', 5)   // Adjust slightly below the line
            .attr('text-anchor', 'end')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(filter.start);

        g.append('text')
            .attr('x', width * 0.8 + 10) // A bit to the right of the end of the line
            .attr('y', 5)   // Adjust slightly below the line
            .attr('text-anchor', 'start')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(filter.finish);

        // Create a tooltip div
        d3.select("body").append("div")
            .attr("id", "filter_tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "lightsteelblue")
            .style("padding", "5px")
            .style("border-radius", "5px")
            .style("pointer-events", "none");


        // Calculate the scale for mapping slider position to values
        const scale = d3.scaleLinear()
        .domain([0, 100])
        .range([filter.start, filter.finish]);

        // Set initial value to the middle of the range
        filter.value = filter.finish;

        // Create a drag behavior for the slider
        const drag = d3.drag()
            .on('drag', (event) => {
                let newValue = Math.max(0, Math.min(100, (event.x / width) * 100));
                filter.value = scale(newValue);

                const lineStart = width * 0.2; // Starting position of the line
                const lineEnd = width * 0.8; // Ending position of the line

                let newCx = Math.max(lineStart, Math.min(lineEnd, event.x));

                // Update the slider position
                sliderFilter.attr('cx', newCx);

                const valueRange = filter.finish - filter.start;
                const scaledValue = filter.start + (newCx - lineStart) * (valueRange / (lineEnd - lineStart));
                filter.value = scaledValue;

                // Update the tooltip text and position during drag
                let filterValue = Math.round(filter.value * 100) / 100

                d3.select('#filter_tooltip')
                    .text(`Value: ${filterValue}`)
                    .style('left', `${newCx + margin.left + 10}px`)
                    .style('top', `${event.sourceEvent.clientY - 20}px`);

                // Update data
                if (filter.id == 1) {
                    const sortedData = data.sort((a, b) => +b.happiness_score - +a.happiness_score);
                    // Calculate the index for the top X% (percentage) of happiness scores
                    const topPercentIndex = Math.ceil(sortedData.length * (filterValue / 100)) - 1;
                    // Get the threshold happiness score for the specified percentage
                    const thresholdScore = +sortedData[topPercentIndex].happiness_score;
                    // Filter the data to include only entries with happiness scores above or equal to the threshold
                    filteredData = sortedData.filter(d => +d.happiness_score >= thresholdScore);
                    LinkedCharts.publish('dataUpdate', filteredData);
                } else if (filter.id == 2) {
                    filteredData = data.filter(d => +d.temperature <= filterValue)
                    LinkedCharts.publish('dataUpdate', filteredData);
                } else if (filter.id == 3) {
                    filteredData = data.filter(d => +d.fertility_rate <= filterValue)
                    LinkedCharts.publish('dataUpdate', filteredData);
                }
            })

        // Create the slider circle
        const sliderFilter = g.append('circle')
            .attr('cx', width * 0.8)
            .attr('cy', 0)
            .attr('r', 6)
            .attr('fill', '#333')
            .style('cursor', 'pointer')
            .call(drag)
            .on('mouseover', (event) => handleMouseOverFilter(event, filter.value)) // Pass the value of the slider
            .on('mouseout', handleMouseOutFilter);
    });
}

function handleMouseOverFilter(event, d) {
    d3.select('#filter_tooltip')
        .style("opacity", 1)
        .html(`Value: ${Math.round(d * 100) / 100}`)
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
}

function handleMouseOutFilter() {
    d3.select("#filter_tooltip")
        .style("opacity", 0);
}
