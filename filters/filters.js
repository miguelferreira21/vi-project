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
        d.happiness_score = +d.happiness_score;
        d.year = +d.year;
    });

    // Get unique regions and add 'All' at the beginning
    regions = ['All', ...new Set(data.map(d => d.region))];

    const minTemp = d3.min(data.filter(d => +d.temperature !== -999.0), d => +d.temperature);
    const maxTemp = d3.max(data, d => d.temperature);
    const minFert = 0
    const maxFert = d3.max(data, d => d.fertility_rate);

    // Data for three bars
    const filtersData = [
        { id: 1, value: 100, title: 'Top happiest countries (%)', start: 0, finish: 100},
        { id: 2, value: maxTemp, title: 'Temperature (°C)', start: minTemp, finish: maxTemp},
        { id: 3, value: maxFert, title: 'Fertility rate', start : minFert, finish: maxFert }
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
        .style("font-family", "Arial")
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
        let tempFilteredData = selectedRegion === 'All' ? data : data.filter(d => d.region === selectedRegion);

        // Apply other filters
        filtersData.forEach(filter => {
            if (filter.id === 1) {
                // Top happiest countries filter
                const years = [...new Set(tempFilteredData.map(d => d.year))];
                tempFilteredData = years.flatMap(year => {
                    const yearData = tempFilteredData.filter(d => d.year === year);
                    const sortedYearData = yearData.sort((a, b) => b.happiness_score - a.happiness_score);
                    const topCount = Math.ceil(sortedYearData.length * (filter.value / 100));
                    return sortedYearData.slice(0, topCount);
                });
            } else if (filter.id === 2) {
                // Temperature filter
                tempFilteredData = tempFilteredData.filter(d => 
                    (filter.value === filter.finish) ? 
                    (d.temperature <= filter.value) : 
                    (d.temperature <= filter.value && d.temperature !== -999.0)
                );
            } else if (filter.id === 3) {
                // Fertility rate filter
                tempFilteredData = tempFilteredData.filter(d => d.fertility_rate <= filter.value);
            }
        });

        filteredData = tempFilteredData;
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
            .style("font-family", "Arial")
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

        // Add labels for start and finish
        g.append('text')
            .attr('x', width * 0.2 - 10)
            .attr('y', 5)
            .attr('text-anchor', 'end')
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .text(filter.start);

        g.append('text')
            .attr('x', width * 0.8 + 10)
            .attr('y', 5)
            .attr('text-anchor', 'start')
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .text(filter.finish);

        // Create a tooltip div
        d3.select("body").append("div")
            .attr("id", "filter_tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "lightsteelblue")
            .style("padding", "5px")
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .style("border-radius", "5px")
            .style("pointer-events", "none");

        // Calculate the scale for mapping slider position to values
        const scale = d3.scaleLinear()
            .domain([width * 0.2, width * 0.8])
            .range([filter.start, filter.finish]);

        // Create a drag behavior for the slider
        const drag = d3.drag()
            .on('drag', (event) => {
                let newCx = Math.max(width * 0.2, Math.min(width * 0.8, event.x));
                filter.value = scale(newCx);

                // Update the slider position
                sliderFilter.attr('cx', newCx);

                // Update the tooltip text and position during drag
                let filterValue = Math.round(filter.value * 100) / 100;

                d3.select('#filter_tooltip')
                    .text(`Value: ${filterValue}`)
                    .style('left', `${newCx + margin.left + 10}px`)
                    .style('top', `${event.sourceEvent.clientY - 20}px`);

                // Update data
                filterData();
            });

        // Create the slider circle
        const sliderFilter = g.append('circle')
            .attr('cx', width * 0.8)
            .attr('cy', 0)
            .attr('r', 6)
            .attr('fill', '#333')
            .style('cursor', 'pointer')
            .call(drag)
            .on('mouseover', (event) => handleMouseOverFilter(event, filter.value))
            .on('mouseout', handleMouseOutFilter);
    });

    // Initial data filter
    filterData();
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
