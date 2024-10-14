function createRooftopMatrix(data, containerId) {
    // Filter out non-numerical columns ("country" and "region")
    var numericalColumns = data.columns.filter(col => !['country', 'region', 'year'].includes(col));

    // Create a nested array to store the correlation values
    var correlations = [];

    const margin = { top: 50, right: 0, bottom: 50, left: innerWidth*0.25 };
    const width = window.innerWidth / 2 - margin.left - margin.right;
    const height = 0.8 * (3 * (window.innerHeight / 7)) - margin.top - margin.bottom;
    const cellSize = Math.min(width, height) / numericalColumns.length;

    // Create the SVG element
    var svg = d3.select(containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", 1.2 * height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create the color scale for the matrix cells
    var colorScale = d3.scaleLinear()
        .domain([-1, 0, 1])
        .range(["red", "white", "green"]);

    // Create a tooltip div that is hidden by default
    var tooltip = d3.select(containerId)
        .append("div")
        .style("position", "absolute")
        .style("background", "#f9f9f9")
        .style("border", "1px solid #d3d3d3")
        .style("padding", "8px")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("opacity", 0);  // Initially hidden

    // Function to create/update the matrix cells
    function updateMatrix(filteredData) {
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
        const cells = svg.selectAll("rect")
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

        // Update event listeners
        svg.selectAll("rect")
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .raise()
                    .style("stroke-width", 3);

                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`Correlation: ${d.value.toFixed(2)}<br>`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mousemove", function(event, d) {
                tooltip.style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .style("stroke-width", 1);

                tooltip.transition().duration(200).style("opacity", 0);
            });
    }

    // Initial update with all data
    updateMatrix(data);

    // Create a scale for positioning the labels
    var yScale = d3.scaleBand()
        .domain(d3.range(numericalColumns.length))
        .range([0, numericalColumns.length * (Math.sqrt(2 * (cellSize ** 2)))]);

    // Add labels for the y-axis (left side attributes)
    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(yScale).tickFormat(i => formatLabel(numericalColumns[i])));

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
            .attr("x1", 0)
            .attr("y1", yScale(index)) // Middle of the cell
            .attr("x2", -maxLabelWidth*0.75) // Set line length based on max label width
            .attr("y2", yScale(index)) // Same as y1
            .style("stroke", "black") // Line color
            .style("stroke-width", 1); // Line width
    });

    // Add an extra line below the last one
    svg.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(numericalColumns.length - 1) + yScale.bandwidth()) // Position below the last tick
        .attr("x2", -maxLabelWidth*0.75) // Set line length based on max label width
        .attr("y2", yScale(numericalColumns.length - 1) + yScale.bandwidth()) // Same as y1
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Add a vertical line from the first horizontal line to the last
    svg.append("line")
        .attr("x1", -maxLabelWidth*0.75) // x-coordinate for vertical line (align with y-axis)
        .attr("y1", yScale(0)) // Start at the first horizontal line
        .attr("x2", -maxLabelWidth*0.75) // Same x-coordinate for vertical line
        .attr("y2", yScale(numericalColumns.length - 1) + yScale.bandwidth()) // End at the position of the last horizontal line
        .style("stroke", "black") // Line color
        .style("stroke-width", 1); // Line width

    // Function to handle year range updates
    function handleYearRangeUpdate(yearRange) {
        const { startYear, endYear } = yearRange;
        const filteredData = data.filter(d => d.year >= startYear && d.year <= endYear);
        updateMatrix(filteredData);
    }

    // Subscribe to year range updates
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);
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
