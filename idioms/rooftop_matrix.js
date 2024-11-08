function createRooftopMatrix(data, containerId) {
    // Filter out non-numerical columns ("country" and "region")
    var numericalColumns = data.columns.filter(col => !['country', 'region', 'year', 'population'].includes(col));

    // Create a nested array to store the correlation values
    var correlations = [];

    const width = d3.select(containerId).node().clientWidth;
    const height = d3.select(containerId).node().clientHeight;
    const cellSize = Math.min(width*0.68, height*0.68) / numericalColumns.length;

    // Create the SVG element
    var svg = d3.select(containerId)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g") // Create a main group
        .attr("transform", "translate(50, 0)"); // Initial translation to move the entire group to the right

    // Create the color scale for the matrix cells
    var colorScale = d3.scaleLinear()
        .domain([-1, 0, 1])
        .range(["red", "white", "green"]);

    // Create a tooltip div that is hidden by default
    var tooltip = d3.select(containerId)
        .append("div")
        .style("position", "absolute")
        .style("background", "lightsteelblue")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("font-family", "Arial")
        .style("font-size", "14px")
        .style("opacity", 0);  // Initially hidden

    // Keep track of the current year range and filtered data
    let currentYearRange = { startYear: d3.min(data, d => d.year), endYear: d3.max(data, d => d.year) };
    let currentFilteredData = data;
    let selectedRegions = null; // Variable to store selected regions
    let selectedCountry = null; // Variable to store selected country

    // Create a group for the matrix
    const matrixGroup = svg.append("g").attr("class", "matrix-group");

    addColorScaleLegend(svg, colorScale, width, height, cellSize);

    // Function to create/update the matrix cells
    function updateMatrix() {
        // Apply year range filter
        let filteredData = currentFilteredData.filter(d => d.year >= currentYearRange.startYear && d.year <= currentYearRange.endYear);

        // Apply region or country filter
        if (selectedRegions && selectedRegions.length > 0) {
            filteredData = filteredData.filter(d => selectedRegions.includes(d.region));
        } else if (selectedCountry) {
            filteredData = filteredData.filter(d => d.country === selectedCountry);
        }

        // Recalculate correlations
        correlations = [];
        for (var i = 0; i < numericalColumns.length; i++) {
            var row = [];
            for (var j = 0; j < numericalColumns.length; j++) {
                if (i < j) {  // Only fill the upper-right triangle
                    row.push(calculateCorrelation(filteredData, numericalColumns[i], numericalColumns[j]));
                } else {
                    row.push(null);  // Keep the lower triangle empty
                }
            }
            correlations.push(row);
        }

        // Flatten the correlations array for easier data binding
        const flatCorrelations = correlations.flatMap((row, i) => 
            row.map((value, j) => ({ value, i, j }))
        ).filter(d => d.value !== null);

        // Separate layers: One for cells, one for symbols
        let cellGroup = svg.select(".cell-group");
        if (cellGroup.empty()) {
            cellGroup = svg.append("g").attr("class", "cell-group");
        }
        let symbolGroup = svg.select(".symbol-group");
        if (symbolGroup.empty()) {
            symbolGroup = svg.append("g").attr("class", "symbol-group");
        }

        // Create/update the matrix cells
        const cells = cellGroup.selectAll("rect")
            .data(flatCorrelations, d => `${d.i}-${d.j}`);

        cells.enter()
            .append("rect")
            .attr("x", d => ((d.j - d.i) * cellSize / Math.SQRT2))
            .attr("y", d => ((d.i + d.j) * cellSize / Math.SQRT2))
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("transform", d => `rotate(45 ${(d.j - d.i) * cellSize / Math.SQRT2}, ${(d.i + d.j) * cellSize / Math.SQRT2}) translate(${Math.sqrt(((width*0.3)**2)/2) + Math.sqrt(((height*0.022)**2)/2)}, ${-Math.sqrt(((width*0.3)**2)/2) + Math.sqrt(((height*0.022)**2)/2)})`) //Adjust cell positions here
            .style("stroke", "black")
            .style("stroke-width", 1)
            .merge(cells)
            .style("fill", d => isNaN(d.value) ? "white" : colorScale(d.value));

        cells.exit().remove();

        // Add/update symbols for strong correlations in a separate layer
        const strongCorrelations = flatCorrelations.filter(d => Math.abs(d.value) > 0.7);

        const symbols = symbolGroup.selectAll("image")
            .data(strongCorrelations, d => `${d.i}-${d.j}`);

        symbols.enter()
            .append("image")
            .attr("xlink:href", "placeholders/icons8-cross.svg")
            .attr("x", d => ((d.j - d.i) * cellSize / Math.SQRT2) - cellSize / 2)  // Adjust position
            .attr("y", d => ((d.i + d.j) * cellSize / Math.SQRT2) + cellSize / 5)  // Adjust position
            .attr("transform", `translate(${width*0.3}, ${height*0.022})`) //Adjust image positions here
            .attr("width", cellSize)   // Adjust size
            .attr("height", cellSize)  // Adjust size
            .style("pointer-events", "none")  // Allow hover events to pass through the image
            .merge(symbols)
            .attr("data-index", d => `${d.i}-${d.j}`);  // Attach data-index for hover interactions

        symbols.exit().remove();

        // Handle hover interactions only on cells (not affecting symbols or legend)
        cellGroup.selectAll("rect")
            .on("mouseover", function(event, d) {
                // Check if the hovered rectangle is part of the matrix
                if (d && d.value !== undefined) {
                
                    // Show tooltip
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(isNaN(d.value) ? "No data" : `Correlation: ${d.value.toFixed(2)}<br>`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                
                    // Highlight all cells in the same row and column by adding a semi-transparent overlay
                    svg.selectAll("rect.overlay").remove();  // Remove existing overlays first
                
                    cellGroup.selectAll("rect")
                        .filter(function(rectData) {
                            return rectData && !((rectData.i === d.i) || (rectData.j === d.j));
                        })
                        .each(function() {
                            // Append a translucent gray rect overlay on top of each filtered cell
                            d3.select(this.parentNode)
                                .append("rect")
                                .attr("class", "overlay")
                                .attr("x", d3.select(this).attr("x"))
                                .attr("y", d3.select(this).attr("y"))
                                .attr("width", d3.select(this).attr("width"))
                                .attr("height", d3.select(this).attr("height"))
                                .attr("transform", d3.select(this).attr("transform")) // Apply the same transformation
                                .style("fill", "rgba(204, 204, 204, 1)") // Set the overlay color with 50% opacity
                                .style("pointer-events", "none");  // Ensure it doesn't interfere with hover events
                        });
                    
                    // Highlight the hovered cell
                    d3.select(this)
                    .raise()
                    .style("stroke-width", 3);
                }
            })
            .on("mouseout", function(event, d) {
                // Check if the hovered rectangle is part of the matrix
                if (d && d.value !== undefined) {
                    // Reset the stroke width and hide the tooltip
                    d3.select(this).style("stroke-width", 1);
                    tooltip.transition().duration(200).style("opacity", 0);
                
                    // Remove the overlay rectangles
                    svg.selectAll("rect.overlay").remove();
                }
            });

        // Update the title
        let title = svg.select(".matrix-title");
        if (title.empty()) {
            title = svg.append("text")
                .attr("class", "matrix-title")
                .attr("x", width / 2)
                .attr("y", 20)
                .attr("text-anchor", "middle")
                .style("font-family", "Arial")
                .attr("font-size", "16px")
                .attr("font-weight", "bold");
        }
        if (filteredData.length === 0) {
            title.text("No data").style("font-size", height*0.05);
        } else if (selectedCountry) {
            title.text(`Correlations for ${selectedCountry}`).style("font-size", height*0.05);
        } else if (selectedRegions && selectedRegions.length > 0) {
            title.text(`Correlations for ${selectedRegions.join(", ")}`).style("font-size", height*0.05);
        } else {
            title.text("Global Correlations").style("font-size", height*0.05);
        }
    }

    // Initial update with all data
    updateMatrix();

    // Create a scale for positioning the labels
    var yScale = d3.scaleBand()
        .domain(d3.range(numericalColumns.length))
        .range([0, numericalColumns.length * (Math.sqrt(2 * (cellSize ** 2)))]);

    // Add labels for the y-axis (left side attributes) with specific class
    const yAxisGroup = svg.append("g")
        .attr("class", "rooftop-matrix-y-axis")  // Changed class name
        .attr("transform", `translate(${width * 0.3}, ${height * 0.022})`);

    // Create y-axis with ticks only for labels
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(i => formatLabel(numericalColumns[i]))
        .ticks(numericalColumns.length);

    // Call the y-axis with specific class for text elements
    yAxisGroup.call(yAxis)
        .selectAll("text")
        .attr("class", "rooftop-matrix-label")  // Added specific class
        .style("font-size", height*0.04);

    // Remove the axis line itself
    yAxisGroup.select(".domain").remove(); // Remove the main axis line

    // Remove the tick lines while keeping the labels
    yAxisGroup.selectAll(".tick line").remove(); // Remove the small tick lines

    // Calculate the maximum label width
    var maxLabelWidth = 0;
    var tempText = svg.append("text") // Create a temporary text element
        .attr("visibility", "hidden") // Hide it from the view
        .style("font-size", height*0.06)   // Apply the same font size used for the actual labels
        .style("font-family", "Arial");

    numericalColumns.forEach((label) => {
        tempText.text(formatLabel(label));
        maxLabelWidth = Math.max(maxLabelWidth, tempText.node().getComputedTextLength());
    });

    tempText.remove(); // Remove the temporary text element

    // Add horizontal lines between each of the attributes with specific class
    numericalColumns.forEach((_, index) => {
        svg.append("line")
            .attr("class", "rooftop-matrix-gridline")  // Added specific class
            .attr("x1", width*0.3)
            .attr("y1", yScale(index) + height*0.022)
            .attr("x2", -maxLabelWidth * 0.75 + width*0.3)
            .attr("y2", yScale(index) + height*0.022)
            .style("stroke", "black")
            .style("stroke-width", 1);
    });

    // Add an extra line below the last one
    svg.append("line")
        .attr("x1", width*0.3)
        .attr("y1", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height*0.022) // Position below the last tick
        .attr("x2", -maxLabelWidth*0.75 + width*0.3) // Set line length based on max label width
        .attr("y2", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height*0.022) // Same as y1
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Add a vertical line from the first horizontal line to the last
    svg.append("line")
        .attr("x1", -maxLabelWidth*0.75 + width*0.3) // x-coordinate for vertical line (align with y-axis)
        .attr("y1", yScale(0) + height*0.022) // Start at the first horizontal line
        .attr("x2", -maxLabelWidth*0.75 + width*0.3) // Same x-coordinate for vertical line
        .attr("y2", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height*0.022) // End at the position of the last horizontal line
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Add a small line at the bottom
        svg.append("line")
        .attr("x1", width*0.3) // x2 from the previous line
        .attr("y1", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height * 0.022) // y2 from the previous line
        .attr("x2", (width*0.3) + (Math.sqrt(2 * (cellSize ** 2)))) // x2 + cellSize
        .attr("y2", (yScale(numericalColumns.length - 1) + yScale.bandwidth() + height * 0.022) - (Math.sqrt(2 * (cellSize ** 2)))) // y2 + cellSize
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Add a small line at the top
    svg.append("line")
    .attr("x1", width*0.3) // x2 from the previous line
    .attr("y1", yScale(0) + height*0.022) // y2 from the previous line
    .attr("x2", (width*0.3) + (Math.sqrt(2 * (cellSize ** 2)))) // x2 + cellSize
    .attr("y2", (yScale(0) + height*0.022) + (Math.sqrt(2 * (cellSize ** 2)))) // y2 + cellSize
    .style("stroke", "black") // Line color
    .style("stroke-width", 1); // Line width

    matrixGroup.attr("transform", `translate(${width*0.3}, ${height*0.022})`);

    // Function to handle year range updates
    function handleYearRangeUpdate(yearRange) {
        currentYearRange = yearRange;
        updateMatrix();
    }

    // Function to handle data updates
    function handleDataUpdate(updatedData) {
        currentFilteredData = updatedData;
        updateMatrix();
    }

    // Function to handle region selection from parallel coordinates
    function handleRegionSelection(selection) {
        if (selection && selection.region) {
            selectedRegions = [selection.region];
            selectedCountry = null; // Clear country selection when region is selected
        } else if (selection && Array.isArray(selection)) {
            selectedRegions = selection;
            selectedCountry = null; // Clear country selection when regions are selected
        } else {
            selectedRegions = null;
        }
        updateMatrix();
    }

    // Function to handle country selection
    function handleCountrySelection(selection) {
        if (selection && selection.country) {
            selectedCountry = selection.country;
            selectedRegions = null; // Clear region selection when country is selected
        } else {
            selectedCountry = null;
        }
        updateMatrix();
    }

    // Subscribe to year range updates
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);

    // Subscribe to data updates
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);

    // Subscribe to parallel coordinates filter
    LinkedCharts.subscribe('parallelCoordinatesFilter', (filteredData) => {
        currentFilteredData = filteredData;
        updateMatrix();
    });

    // Subscribe to region selection from parallel coordinates
    LinkedCharts.subscribe('regionSelection', handleRegionSelection);

    // Subscribe to country selection
    LinkedCharts.subscribe('countrySelection', handleCountrySelection);
}

// Function to calculate correlation, ignoring missing values
function calculateCorrelation(data, xCol, yCol) {
    // Filter out rows with missing values for xCol or yCol
    var filteredData = data.filter(d => d[xCol] != -999 && d[yCol] != -999);

    if (filteredData.length === 0) return 0; // If no valid data is left, return 0 correlation

    // Calculate the means of x and y
    var xMean = d3.mean(filteredData, d => d[xCol]);
    var yMean = d3.mean(filteredData, d => d[yCol]);

    // Calculate the standard deviations of x and y
    var xStdDev = Math.sqrt(d3.mean(filteredData, d => Math.pow(d[xCol] - xMean, 2)));
    var yStdDev = Math.sqrt(d3.mean(filteredData, d => Math.pow(d[yCol] - yMean, 2)));

    // Calculate the covariance of x and y
    var covariance = d3.mean(filteredData, d => (d[xCol] - xMean) * (d[yCol] - yMean));

    // Calculate the correlation coefficient
    return covariance / (xStdDev * yStdDev);
}

function formatLabel(label) {
    // Replace underscores with spaces and split into words
    let words = label.replace(/_/g, ' ').split(' ');

    // Map over each word to capitalize first letter and handle "gdp"
    words = words.map(word => {
        // Special case for "gdp"
        if (word.toLowerCase() === "gdp") {
            return "GDP"; // Return "GDP" for any occurrence of "gdp"
        }
        // Capitalize the first letter of other words
        return word.charAt(0).toUpperCase() + word.slice(1);
    });

    // Join the words back together
    return words.join(' ');
}

function addColorScaleLegend(svg, colorScale, width, height, cellSize) {
    // Define the color legend dimensions
    const legendWidth = width * 0.03;  // Adjust the width of the legend bar
    const legendHeight = height * 0.6;  // Adjust the height of the legend bar

    // Create a gradient for the color scale
    const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "color-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    // Define the color stops for the gradient (-1 to 1)
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "red");
    gradient.append("stop").attr("offset", "50%").attr("stop-color", "white");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "green");

    // Append a rectangle filled with the gradient to represent the color scale
    svg.append("rect")
        .attr("x", width * 0.65)
        .attr("y", height * 0.2)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#color-gradient)");

    // Add text on top of legend
    svg.append("text")
        .attr("x", width * 0.625)
        .attr("y", height * 0.13)
        .style("font-family", "Arial")
        .style("font-size", height * 0.038)
        .style("alignment-baseline", "middle")
        .text("Correlation"); // Replace with the actual description

    // Create a scale for the legend axis (from -1 to 1)
    const legendScale = d3.scaleLinear()
        .domain([-1, 1])
        .range([legendHeight, 0]);

    // Create the axis for the color legend
    const legendAxis = d3.axisRight(legendScale)
        .tickValues([-1, -0.5, 0, 0.5, 1])  // Adjust tick values
        .tickFormat(d3.format(".1f"));  // Format the tick labels

    // Append the axis to the right of the legend
    svg.append("g")
        .attr("transform", `translate(${width * 0.675}, ${height * 0.2})`)
        .style("font-family", "Arial")
        .style("font-size", height * 0.03)
        .call(legendAxis);

    // Style the axis and remove the domain line
    svg.selectAll(".domain").remove();
    svg.selectAll(".tick line").remove(); // Remove tick lines

    // Add symbol for legend
    svg.append("image")
        .attr("xlink:href", "placeholders/icons8-cross.svg")
        .attr("x", width * 0.651)
        .attr("y", height * 0.25 + legendHeight)
        .attr("width", cellSize)   // Adjust size
        .attr("height", cellSize);

    // Add text next to the symbol
    svg.append("text")
        .attr("x", width * 0.685)
        .attr("y", height * 0.29 + legendHeight)
        .style("font-family", "Arial")
        .style("font-size", height * 0.035)
        .style("alignment-baseline", "middle")
        .text("Strong Correlation"); // Replace with the actual description
}
