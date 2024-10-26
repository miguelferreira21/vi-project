let regions = []; // Stores all the regions
let selectedRegions = []; // Track selected regions

function createFilters(data, containerId) {
    // Set up the dimensions
    const margin = { top: 20, right: 30, bottom: 50, left: 30 };
    const containerWidth = d3.select(containerId).node().clientWidth;
    const containerHeight = d3.select(containerId).node().clientHeight;

    // Calculate width and height based on container dimensions
    const width = containerWidth * 0.20;
    const height = containerHeight; // Full height minus margins
    const lineThickness = 2;

    // Convert values to numbers
    data.forEach(d => {
        d.temperature = +d.temperature;
        d.fertility_rate = +d.fertility_rate;
        d.happiness_score = +d.happiness_score;
        d.year = +d.year;
    });

    // Save all the regions
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

    // Min and max values for temperature and fertility
    const minTemp = d3.min(data.filter(d => +d.temperature !== -999.0), d => +d.temperature).toFixed(2);
    const maxTemp = d3.max(data, d => d.temperature).toFixed(2);
    const minFert = d3.min(data.filter(d => +d.fertility_rate !== -999.0), d => +d.fertility_rate).toFixed(2);
    const maxFert = d3.max(data, d => d.fertility_rate).toFixed(2);

    // Data for three bars
    const filtersData = [
        { id: 1, leftValue: 0, rightValue: 100, title: 'Top happiest countries (%)', start: 0, finish: 100 },
        { id: 2, leftValue: minTemp, rightValue: maxTemp, title: 'Temperature (°C)', start: minTemp, finish: maxTemp },
        { id: 3, leftValue: minFert, rightValue: maxFert, title: 'Fertility rate', start: minFert, finish: maxFert }
    ];

    // Select the container
    const container = d3.select(containerId)
        .style('display', 'flex')
        .style('flex-direction', 'row')
        .style('gap', "1%") // Fixed gap to prevent excessive spacing
        .style('height', `${containerHeight}`) // Ensure container has defined height
        .style('overflow', 'hidden'); // Prevent overflow

    // Create a container for the sliders
    const slidersContainer = container.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', "2%")
        .style('margin-top', '1.5%')
        .style('margin-bottom', '1.5%')
        .style('margin-left', '1.5%')  // Add left margin to move sliders to the right
        .style('flex', '1 1 auto')
        .style('height', '90%')
        .style('width', '100%');

    // Calculate Dynamic Gap for Checkbox Container
    const totalCheckboxItems = regions.length + 2; // Including "Select All"
    const minGap = 8;
    const maxGap = 30;
    const calculatedGap = Math.max(minGap, Math.min(maxGap, (height - 20) / totalCheckboxItems));

    // Create a region filter with checkboxes
    const checkboxContainer = container.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', '2%') // Dynamic gap based on container's height
        .style('margin-top', '1.5%')
        .style('margin-bottom', '1.5%')
        .style('margin-right', '1.5%')
        .style('width', '65%')
        .style('height', '90%')
        .style('flex', '0 0 auto');

    // Scale for average happiness bars
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(avgHappinessScores, d => d.averageHappiness)])
        .range([0, 100]);

    // Create a "Select All" checkbox
    const selectAllRow = checkboxContainer.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('height', '6%');

    // Add the "Select All" checkbox
    const selectAllCheckbox = selectAllRow.append('input')
        .attr('type', 'checkbox')
        .attr('checked', true)  // All checked by default
        .on('change', function () {
            const isChecked = d3.select(this).property('checked');

            // Set all region checkboxes to the state of the "Select All" checkbox
            checkboxContainer.selectAll('input.region-checkbox')
                .property('checked', isChecked);

            // Update selectedRegions based on the current state
            selectedRegions = isChecked ? regions.slice() : [];

            // Call the filter function using the updated selected regions
            filterData();
        });

    // Add the label for "Select All"
    selectAllRow.append('span')
        .style('font-family', 'Arial')
        .style('font-size', height*0.05 + 'px')
        .style('font-weight', 'bold')
        .style('width', '50%')
        .style('text-align', 'left')
        .style('white-space', 'normal')
        .text('Select All');

    // Calculate the height for each checkbox item based on the totalCheckboxItems
    const checkboxHeight = (90 / totalCheckboxItems) + "%"; // Use 90% of container height

    // Create checkboxes for each region
    regions.forEach(region => {
        const checkboxRow = checkboxContainer.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('height', checkboxHeight)  // Use percentage height

        // Add the region checkbox
        checkboxRow.append('input')
            .attr('type', 'checkbox')
            .attr('class', 'region-checkbox')  // Add class to easily select all region checkboxes
            .attr('checked', true)  // All checked by default
            .on('change', function () {
                // Update the selected regions array
                selectedRegions = [];
                checkboxContainer.selectAll('input.region-checkbox').each(function () {
                    if (d3.select(this).property('checked')) {
                        selectedRegions.push(d3.select(this.nextSibling).text());
                    }
                });

                // If all region checkboxes are checked, also check "Select All"
                // If not all are checked, uncheck "Select All"
                const allChecked = checkboxContainer.selectAll('input.region-checkbox')
                    .filter(function () { return !d3.select(this).property('checked'); }).empty();
                selectAllCheckbox.property('checked', allChecked);

                // Call the filter function using the updated selected regions
                filterData();
            });

        // Add the label for the region checkbox
        checkboxRow.append('span')
            .style('font-family', 'Arial')
            .style('font-size', height*0.04 + 'px')
            .style('width', "50%")
            .style('text-align', 'left')
            .style('white-space', 'normal')
            .text(region);

        // Find the average happiness score for this region
        const avgHappiness = avgHappinessScores.find(d => d.region === region)?.averageHappiness || 0;

        // Add the bar for the average happiness next to the checkbox
        checkboxRow.append('div')
            .datum(avgHappiness.toFixed(2))
            .style('width', `${xScale(avgHappiness)*0.35}%`)
            .style('height', '10px')  // Adjust the height of the bar as needed
            .style('background-color', 'steelblue')
            .style('margin-left', '5%')
            .on('mouseover', handleMouseOverBar)
            .on('mouseout', handleMouseOutBar);
    });

    function filterData() {
        // True if filters aren't used
        let allAtMax = true;

        // Filter data only by selected regions
        let filteredData = data.filter(d => selectedRegions.includes(d.region));

        // Apply other filters
        filtersData.forEach(filter => {
            if (filter.id === 1) {
                // Top happiest countries filter
                const years = [...new Set(filteredData.map(d => d.year))];
                filteredData = years.flatMap(year => {
                    const yearData = filteredData.filter(d => d.year === year);
                    const sortedYearData = yearData.sort((a, b) => b.happiness_score - a.happiness_score);

                    const lowerIndex = Math.floor(sortedYearData.length * (filter.leftValue / 100));
                    const upperIndex = Math.ceil(sortedYearData.length * (filter.rightValue / 100));

                    return sortedYearData.slice(lowerIndex, upperIndex);
                });
            } else if (filter.id === 2) {
                // Temperature filter
                filteredData = filteredData.filter(d =>
                    (filter.value === filter.finish) ?
                        (d.temperature >= filter.leftValue && d.temperature <= filter.rightValue) :
                        (d.temperature >= filter.leftValue && d.temperature <= filter.rightValue && d.temperature !== -999.0)
                );
            } else if (filter.id === 3) {
                // Fertility rate filter
                filteredData = filteredData.filter(d =>
                    d.fertility_rate >= filter.leftValue && d.fertility_rate <= filter.rightValue
                );
            }

            allAtMax = allAtMax && filter.rightValue === filter.finish && filter.leftValue == filter.start;
        });

        // If filters aren't used and all countries are selected
        // Keep the original data
        if (allAtMax && selectedRegions.length === regions.length) {
            LinkedCharts.publish('dataUpdate', data);
        } else {
            LinkedCharts.publish('dataUpdate', filteredData);
        }
    }

    const totalSliderItems = filtersData.length;
    const sliderHeight = (90 / totalSliderItems) + "%";

    // Create SVG elements for each slider's bar
    filtersData.forEach(filter => {
        const svg = slidersContainer.append('svg')
            .attr('width', '100%')
            .attr('height', sliderHeight)
            .style('max-height', sliderHeight);// Ensure SVG respects height

        // Create a title above each slider's bar
        svg.append('text')
            .attr('x', '50%')
            .attr('y', '30%')
            .attr('text-anchor', 'middle')
            .attr('font-size', width*0.09 + 'px')
            .style("font-family", "Arial")
            .text(filter.title);

        // Create a group element to hold the bar and slider
        const g = svg.append('g')
            .attr('transform', `translate(0, ${svg.node().clientHeight * 0.6})`);

        // Create a thin line as the slider track
        g.append('line')
            .attr('x1', '15%')
            .attr('x2', '85%')
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', '#ddd')
            .attr('stroke-width', lineThickness);

        // Add filter's start value
        g.append('text')
            .attr('x', '12%')  // Move start label slightly more to the left
            .attr('y', '5%')
            .attr('text-anchor', 'end')
            .style("font-family", "Arial")
            .style("font-size", width*0.07 + 'px')
            .text(filter.start);

        // Add filter's end value
        g.append('text')
            .attr('x', '88%')  // Move end label slightly more to the right
            .attr('y', '5%')
            .attr('text-anchor', 'start')
            .style("font-family", "Arial")
            .style("font-size", width*0.07 + 'px')
            .text(filter.finish);

        // Create a tooltip div (ensure it's only created once)
        if (d3.select("#filter_tooltip").empty()) {
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
        }

        // Calculate the scale for mapping slider position to values
        const scale = d3.scaleLinear()
            .domain([slidersContainer.node().clientWidth * 0.15, slidersContainer.node().clientWidth * 0.85])
            .range([filter.start, filter.finish]);

        // Create a drag behavior for the sliders
        const drag = d3.drag()
            .on('drag', function (event) {
                // Get the current slider being dragged
                const currentSlider = d3.select(this);
                const isLeftSlider = currentSlider.attr('data-type') === 'left';

                // Get the position of the other slider
                const otherSlider = isLeftSlider ? d3.select('[data-type="right"]') : d3.select('[data-type="left"]');
                const otherCx = parseFloat(otherSlider.attr('cx'));

                // Calculate the new x position based on the drag
                let newCx = Math.max(slidersContainer.node().clientWidth * 0.15, 
                                    Math.min(slidersContainer.node().clientWidth * 0.85, event.x));

                // Prevent overlapping
                if (isLeftSlider) {
                    // If dragging left slider, ensure it doesn't go past the right slider
                    newCx = Math.min(newCx, otherCx*0.95);
                    filter.leftValue = scale(newCx);
                } else {
                    // If dragging right slider, ensure it doesn't go before the left slider
                    newCx = Math.max(newCx, otherCx*0.05);
                    filter.rightValue = scale(newCx);
                }

                // Update the position of the currently dragged slider
                currentSlider.attr('cx', newCx);

                // Update data with new filter values
                filterData();
            });



        // Create the right slider
        const rightSlider = g.append('circle')
            .attr('cx', slidersContainer.node().clientWidth * 0.85)
            .attr('cy', 0)
            .attr('r', width*0.04)
            .attr('fill', '#333')
            .attr('data-type', 'right') // Add data attribute to identify slider type
            .style('cursor', 'pointer')
            .call(drag)
            .on('mouseover', (event) => handleMouseOverFilter(event, filter.rightValue))
            .on('mouseout', handleMouseOutFilter);

        // Create the left slider
        const leftSlider = g.append('circle')
            .attr('cx', slidersContainer.node().clientWidth * 0.15)
            .attr('cy', 0)
            .attr('r', width*0.04)
            .attr('fill', '#333')
            .attr('data-type', 'left') // Add data attribute to identify slider type
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

// Function to handle mouseover and display tooltip
function handleMouseOverBar(event, avgHappiness) {
    // You can access avgHappiness directly here
    const tooltip = d3.select('#tooltip');  // Assuming you have a tooltip element
    tooltip
        .style('opacity', 1)
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 20}px`)
        .style('font-family', 'Arial')
        .html(`Average Happiness: ${avgHappiness}`);
}

// Function to handle mouseout and hide tooltip
function handleMouseOutBar() {
    const tooltip = d3.select('#tooltip');  // Assuming you have a tooltip element
    tooltip.style('opacity', 0);
}