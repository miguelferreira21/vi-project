let filteredData;
let regions = [];
let selectedRegions = []; // Track selected regions

function createFilters(data, containerId) {
    // Set up the dimensions
    const margin = { top: 20, right: 30, bottom: 50, left: 0 }; // Added right margin for checkboxes
    const width = 400; // Set a fixed width for the slidebars
    const height = window.innerHeight / 10; // Keep the height of the slidebars
    const lineThickness = 2;

    // Convert values to numbers
    data.forEach(d => {
        d.temperature = +d.temperature;
        d.fertility_rate = +d.fertility_rate;
        d.happiness_score = +d.happiness_score;
        d.year = +d.year;
    });

    // Get unique regions and add 'All' at the beginning
    regions = [...new Set(data.map(d => d.region))];
    selectedRegions = regions;

    // Calculate the average happiness score for each region
    const avgHappinessScores = regions.map(region => {
        const filteredData = data.filter(d => d.region === region);
        const totalScore = filteredData.reduce((acc, d) => acc + d.happiness_score, 0);
        return {
            region: region,
            averageHappiness: filteredData.length > 0 ? totalScore / filteredData.length : 0
        };
    });
    
    const minTemp = d3.min(data.filter(d => +d.temperature !== -999.0), d => +d.temperature);
    const maxTemp = d3.max(data, d => d.temperature);
    const minFert = 0;
    const maxFert = d3.max(data, d => d.fertility_rate);

    // Data for three bars
    const filtersData = [
        { id: 1, leftValue: 0, rightValue: 100, title: 'Top happiest countries (%)', start: 0, finish: 100 },
        { id: 2, leftValue: minTemp, rightValue: maxTemp, title: 'Temperature (°C)', start: minTemp, finish: maxTemp },
        { id: 3, leftValue: minFert, rightValue: maxFert, title: 'Fertility rate', start: minFert, finish: maxFert }
    ];

    // Select the container
    const container = d3.select(containerId)
        .style('display', 'flex')
        .style('flex-direction', 'row') // Arrange slidebars and checkboxes horizontally
        .style('gap', '10px'); // Space between slidebars and checkbox column

    // Create a container for the slidebars
    const slidersContainer = container.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', '20px')
        .style('margin-top', '20px');

    // Create a region filter with checkboxes
    const checkboxContainer = container.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', '5px');

    const chartWidth = 100; // Set desired width for the bars
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(avgHappinessScores, d => d.averageHappiness)])
        .range([0, chartWidth]);

    // Create checkboxes for each region
    regions.forEach(region => {
        const checkboxRow = checkboxContainer.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '-10px');
    
        // Add the checkbox
        checkboxRow.append('input')
            .attr('type', 'checkbox')
            .attr('checked', true) // All checked by default
            .on('change', function() {
                // Update the filter based on selected regions
                selectedRegions = [];
                checkboxContainer.selectAll('input').each(function() {
                    if (d3.select(this).property('checked')) {
                        selectedRegions.push(d3.select(this.nextSibling).text());
                    }
                });
    
                // Call the filter function using the selected regions
                filterData();
            });
    
        // Add the label for the checkbox
        checkboxRow.append('span')
            .style('font-family', 'Arial')
            .style('width', '300px')
            .style('text-align', 'left')
            .style('white-space', 'normal')
            .text(region);
    
        // Find the average happiness score for this region
        const avgHappiness = avgHappinessScores.find(d => d.region === region)?.averageHappiness || 0;
    
        // Add the bar for the average happiness next to the checkbox
        checkboxRow.append('div')
            .style('width', `${xScale(avgHappiness)}px`)
            .style('height', '10px') // Adjust the height of the bar as needed
            .style('background-color', 'steelblue')
            .style('margin-left', '20px');
    });

    function filterData() {
        // If no region is selected, filter by all
        let tempFilteredData = data.filter(d => selectedRegions.includes(d.region));

        // Apply other filters
        filtersData.forEach(filter => {
            if (filter.id === 1) {
                // Top happiest countries filter
                const years = [...new Set(tempFilteredData.map(d => d.year))];
                tempFilteredData = years.flatMap(year => {
                    const yearData = tempFilteredData.filter(d => d.year === year);
                    const sortedYearData = yearData.sort((a, b) => b.happiness_score - a.happiness_score);

                    const lowerIndex = Math.floor(sortedYearData.length * (filter.leftValue / 100));
                    const upperIndex = Math.ceil(sortedYearData.length * (filter.rightValue / 100));
        
                    return sortedYearData.slice(lowerIndex, upperIndex);
                });
            } else if (filter.id === 2) {
                // Temperature filter
                tempFilteredData = tempFilteredData.filter(d =>
                    (filter.value === filter.finish) ?
                        (d.temperature >= filter.leftValue && d.temperature <= filter.rightValue) :
                        (d.temperature >= filter.leftValue && d.temperature <= filter.rightValue && d.temperature !== -999.0)
                );
            } else if (filter.id === 3) {
                // Fertility rate filter
                tempFilteredData = tempFilteredData.filter(d =>
                    d.fertility_rate >= filter.leftValue && d.fertility_rate <= filter.rightValue
                );
            }
        });

        filteredData = tempFilteredData;
        LinkedCharts.publish('dataUpdate', filteredData);
    }

    // Create SVG elements for each bar
    filtersData.forEach(filter => {
        const svg = slidersContainer.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height);

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
        .on('drag', function(event) {
            // Get the current slider being dragged
            const currentSlider = d3.select(this);
            
            // Get the current positions of both sliders
            const leftCx = parseFloat(leftSlider.attr('cx'));
            const rightCx = parseFloat(rightSlider.attr('cx'));

            // Calculate the new x position based on the drag
            let newCx = Math.max(width * 0.2, Math.min(width * 0.8, event.x));

            // Determine if dragging the left or right slider
            if (currentSlider.attr('cx') === leftCx.toString()) {
                // Left slider dragged
                // Prevent left slider from going beyond the right slider
                newCx = Math.min(newCx, rightCx - 6); // Subtract radius to prevent overlap
                filter.leftValue = scale(newCx);
            } else {
                // Right slider dragged
                // Prevent right slider from going before the left slider
                newCx = Math.max(newCx, leftCx + 6); // Add radius to prevent overlap
                filter.rightValue = scale(newCx);
            }

            // Update the position of the currently dragged slider
            currentSlider.attr('cx', newCx);

            // Update data
            filterData();
        });

    // Create the right slider
    const rightSlider = g.append('circle')
        .attr('cx', width * 0.8)
        .attr('cy', 0)
        .attr('r', 6)
        .attr('fill', '#333')
        .style('cursor', 'pointer')
        .call(drag)
        .on('mouseover', (event) => handleMouseOverFilter(event, filter.rightValue))
        .on('mouseout', handleMouseOutFilter);

    // Create the left slider
    const leftSlider = g.append('circle')
        .attr('cx', width * 0.2)
        .attr('cy', 0)
        .attr('r', 6)
        .attr('fill', '#333')
        .style('cursor', 'pointer')
        .call(drag)
        .on('mouseover', (event) => handleMouseOverFilter(event, filter.leftValue))
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
