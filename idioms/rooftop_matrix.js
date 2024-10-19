function createRooftopMatrix(data, containerId) {
    // Filter out non-numerical columns ("country" and "region")
    var numericalColumns = data.columns.filter(col => !['country', 'region', 'year'].includes(col));

    // Create a nested array to store the correlation values
    var correlations = [];

    const width = d3.select(containerId).node().clientWidth * 0.995;
    const height = d3.select(containerId).node().clientHeight * 1.52;
    const cellSize = Math.min(width*0.65, height*0.65) / numericalColumns.length;


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

    // Create a group for the matrix
    const matrixGroup = svg.append("g").attr("class", "matrix-group");

    // Function to create/update the matrix cells
    function updateMatrix() {
        // Apply both year range and other filters
        const filteredData = currentFilteredData.filter(d => d.year >= currentYearRange.startYear && d.year <= currentYearRange.endYear);

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

        // Create/update the matrix cells
        const cells = matrixGroup.selectAll("rect")
            .data(flatCorrelations, d => `${d.i}-${d.j}`);

        cells.enter()
            .append("rect")
            .attr("x", d => ((d.j - d.i) * cellSize / Math.SQRT2))
            .attr("y", d => ((d.i + d.j) * cellSize / Math.SQRT2))
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("transform", d => `rotate(45 ${(d.j - d.i) * cellSize / Math.SQRT2}, ${(d.i + d.j) * cellSize / Math.SQRT2})`)
            .style("stroke", "black")
            .style("stroke-width", 1)
            .merge(cells)
            .style("fill", d => colorScale(d.value));

        cells.exit().remove();

        // Add/update symbols for strong correlations in a separate layer
        const strongCorrelations = flatCorrelations.filter(d => Math.abs(d.value) > 0.7);

        const symbols = matrixGroup.selectAll("image")
            .data(strongCorrelations, d => `${d.i}-${d.j}`);

        symbols.enter()
            .append("image")
            .attr("xlink:href", "placeholders/icons8-cross.svg")
            .attr("x", d => ((d.j - d.i) * cellSize / Math.SQRT2) - cellSize / 2)  // Adjust position
            .attr("y", d => ((d.i + d.j) * cellSize / Math.SQRT2) + cellSize / 5)  // Adjust position
            .attr("width", cellSize)   // Adjust size
            .attr("height", cellSize)  // Adjust size
            .style("pointer-events", "none")  // Allow hover events to pass through the image
            .merge(symbols)
            .attr("data-index", d => `${d.i}-${d.j}`);  // Attach data-index for hover interactions

        symbols.exit().remove();

        // Handle hover interactions only on cells (not affecting symbols)
        matrixGroup.selectAll("rect")
            .on("mouseover", function(event, d) {
                // Highlight the cell (but do not raise it)
                d3.select(this)
                    .raise()
                    .style("stroke-width", 3);

                // Show tooltip
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`Correlation: ${d.value.toFixed(2)}<br>`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mousemove", function(event, d) {
                // Move tooltip with the mouse
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function(event, d) {
                // Reset the stroke width and hide the tooltip
                d3.select(this).style("stroke-width", 1);
                tooltip.transition().duration(200).style("opacity", 0);
            });
    }

    // Initial update with all data
    updateMatrix();

    // Create a scale for positioning the labels
    var yScale = d3.scaleBand()
        .domain(d3.range(numericalColumns.length))
        .range([0, numericalColumns.length * (Math.sqrt(2 * (cellSize ** 2)))]);

    // Add labels for the y-axis (left side attributes)
    const yAxisGroup = svg.append("g")
        .attr("class", "y axis")
        .attr("transform", `translate(${width * 0.3}, ${height * 0.04})`); // Ensure y-axis is at the origin

    // Create y-axis with ticks only for labels
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(i => formatLabel(numericalColumns[i])) // Format labels
        .ticks(numericalColumns.length); // Set ticks according to the number of labels

    // Call the y-axis
    yAxisGroup.call(yAxis);

    // Remove the axis line itself
    yAxisGroup.select(".domain").remove(); // Remove the main axis line

    // Remove the tick lines while keeping the labels
    yAxisGroup.selectAll(".tick line").remove(); // Remove the small tick lines

    // Calculate the maximum label width
    var maxLabelWidth = 0;
    var tempText = svg.append("text") // Create a temporary text element
        .attr("visibility", "hidden"); // Hide it from the view

    numericalColumns.forEach((label) => {
        tempText.text(formatLabel(label));
        maxLabelWidth = Math.max(maxLabelWidth, tempText.node().getComputedTextLength());
    });

    tempText.remove(); // Remove the temporary text element

    // Add horizontal lines between each of the attributes on the y-axis
    numericalColumns.forEach((_, index) => {
        svg.append("line")
            .attr("x1", width*0.3)
            .attr("y1", yScale(index) + height*0.04) // Middle of the cell
            .attr("x2", -maxLabelWidth * 0.75 + width*0.3) // Set line length based on max label width
            .attr("y2", yScale(index) + height*0.04) // Same as y1
            .style("stroke", "black") // Line color
            .style("stroke-width", 1); // Line width
    });

    // Add an extra line below the last one
    svg.append("line")
        .attr("x1", width*0.3)
        .attr("y1", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height*0.04) // Position below the last tick
        .attr("x2", -maxLabelWidth*0.75 + width*0.3) // Set line length based on max label width
        .attr("y2", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height*0.04) // Same as y1
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Add a vertical line from the first horizontal line to the last
    svg.append("line")
        .attr("x1", -maxLabelWidth*0.75 + width*0.3) // x-coordinate for vertical line (align with y-axis)
        .attr("y1", yScale(0) + height*0.04) // Start at the first horizontal line
        .attr("x2", -maxLabelWidth*0.75 + width*0.3) // Same x-coordinate for vertical line
        .attr("y2", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height*0.04) // End at the position of the last horizontal line
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Add a small line at the bottom
        svg.append("line")
        .attr("x1", width*0.3) // x2 from the previous line
        .attr("y1", yScale(numericalColumns.length - 1) + yScale.bandwidth() + height * 0.04) // y2 from the previous line
        .attr("x2", (width*0.3) + (Math.sqrt(2 * (cellSize ** 2)))) // x2 + cellSize
        .attr("y2", (yScale(numericalColumns.length - 1) + yScale.bandwidth() + height * 0.04) - (Math.sqrt(2 * (cellSize ** 2)))) // y2 + cellSize
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Add a small line at the top
    svg.append("line")
    .attr("x1", width*0.3) // x2 from the previous line
    .attr("y1", yScale(0) + height*0.04) // y2 from the previous line
    .attr("x2", (width*0.3) + (Math.sqrt(2 * (cellSize ** 2)))) // x2 + cellSize
    .attr("y2", (yScale(0) + height*0.04) + (Math.sqrt(2 * (cellSize ** 2)))) // y2 + cellSize
    .style("stroke", "black") // Line color
    .style("stroke-width", 1); // Line width

    matrixGroup.attr("transform", `translate(${width*0.3}, ${height*0.04})`);

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

    // Subscribe to year range updates
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);

    // Subscribe to data updates
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);
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
