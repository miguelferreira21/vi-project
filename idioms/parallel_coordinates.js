function createParallelCoordinates(initialData, containerId) {
    let data = initialData;
    const keys = Object.keys(data[0]).filter(d => d !== 'country' && d !== 'year' && d !== 'region');
    let currentColorKey = 'happiness_score'; // Default key for color scale

    // Replace names in the chart
    const columnNameMap = {
        'happiness_score': 'Happiness Score',
        'healthy_life_expectancy': 'Healthy Life expectancy',
        'freedom_to_make_life_choices': 'Freedom',
        'perceptions_of_corruption': 'Perception of Corruption',
        'gdp_per_capita': 'GDP per Capita (GK$)',
        'social_support': 'Social Support',
        'generosity': 'Generosity',
        'temperature': 'Temperature',
        'fertility_rate': 'Fertility rate'
    };

    // Function to get the display name for a key
    const getDisplayName = (key) => columnNameMap[key] || key;

    // Update keys to use display names
    const displayKeys = keys.map(getDisplayName);

    const margin = { top: 60, right: 150, bottom: 30, left: 12 };
    const container = d3.select(containerId);
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height * 1.65;
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // Clear the container
    container.selectAll("*").remove();

    // Create a wrapper div for both canvas and svg
    const wrapper = container.append("div")
        .style("position", "relative")
        .style("width", containerWidth + "px")
        .style("height", containerHeight + "px");

    // Create canvas element
    const canvas = wrapper.append('canvas')
        .attr('width', width)
        .attr('height', height)
        .style('position', 'absolute')
        .style('left', margin.left + 'px')
        .style('top', margin.top + 'px');

    const context = canvas.node().getContext('2d');

    // Create SVG for axes, brushes, and legend
    const svg = wrapper.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .style("position", "absolute")
        .style("top", "0px")
        .style("left", "0px")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
        .range([0, width])
        .padding(0.75)
        .domain(displayKeys);

    const y = {};
    for (let key of keys) {
        if (key === 'temperature') {
            y[key] = d3.scaleLinear()
                .domain([d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]), d3.max(data, d => +d[key])])
                .range([height, 0]);
        } else if (key === 'fertility_rate') {
            y[key] = d3.scaleLinear()
                .domain([0, d3.max(data, d => +d[key])])
                .range([height, 0]);
        } else {
            y[key] = d3.scaleLinear()
                .domain(d3.extent(data, d => +d[key]))
                .range([height, 0]);
        }
    }

    // Function to get the color scale based on the selected attribute
    const getColorScale = (key) => {
        if (key === 'temperature') {
            return d3.scaleSequential(d3.interpolateBrBG)
                .domain([
                    d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]),
                    d3.max(data, d => +d[key])
                ]);
        } else if (key === 'fertility_rate') {
            return d3.scaleSequential(d3.interpolateBrBG)
                .domain([0, d3.max(data, d => +d[key])]);
        } else {
            return d3.scaleSequential(d3.interpolateBrBG)
                .domain(d3.extent(data, d => +d[key]));
        }
    };

    let color = getColorScale(currentColorKey);

    // Add axes with interactive titles
    const axes = svg.selectAll("myAxis")
        .data(keys).enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(getDisplayName(d))},0)`)
        .each(function(d) { d3.select(this).call(d3.axisLeft().scale(y[d])); });

    axes.append("text")
        .style("text-anchor", "middle")
        .style("font-size", "10.5px")
        .attr("y", height + 20)
        .text(d => getDisplayName(d))
        .style("fill", "black")
        .attr("class", "axis-title")
        .on("mouseover", function() {
            d3.select(this).style("cursor", "pointer").style("font-weight", "bold");
        })
        .on("mouseout", function() {
            if (d3.select(this).attr("data-selected") !== "true") {
                d3.select(this).style("font-weight", "normal");
            }
        })
        .on("click", function(event, d) {
            const isSelected = d3.select(this).attr("data-selected") === "true";
            axes.selectAll(".axis-title")
                .attr("data-selected", "false")
                .style("font-weight", "normal");
            
            if (!isSelected) {
                d3.select(this).attr("data-selected", "true").style("font-weight", "bold");
                updateColorScale(d);
            } else {
                updateColorScale('happiness_score');
            }
        });

    // Create brush for each axis except happiness_score
    const brush = d3.brushY()
        .extent([[-15, 0], [15, height]])
        .on("start brush end", brushed);

    svg.selectAll(".axis")
        .filter(d => d !== 'happiness_score')
        .append("g")
        .attr("class", "brush")
        .each(function(d) { d3.select(this).call(brush); });

    let activeBrushes = new Map();

    function brushed(event, key) {
        if (key === 'happiness_score') return;
        const selection = event.selection;
        if (selection) {
            activeBrushes.set(key, selection);
        } else {
            activeBrushes.delete(key);
        }
        drawLines(data);
    }

    function updateColorScale(key) {
        currentColorKey = key;
        
        // Update color scale domain based on the selected key
        if (key === 'temperature') {
            color = d3.scaleSequential(d3.interpolateBrBG)
                .domain([
                    d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]),
                    d3.max(data, d => +d[key])
                ]);
        } else if (key === 'fertility_rate') {
            color = d3.scaleSequential(d3.interpolateBrBG)
                .domain([0, d3.max(data, d => +d[key])]);
        } else {
            color = d3.scaleSequential(d3.interpolateBrBG)
                .domain(d3.extent(data, d => +d[key]));
        }

        updateLegend();
        drawLines(data);
    }

    function drawLines(filteredData) {
        context.clearRect(0, 0, width, height);
        
        filteredData.forEach(d => {
            let isActive = true;
            context.beginPath();
            context.moveTo(x(displayKeys[0]), y[keys[0]](d[keys[0]]));
            
            for (let i = 1; i < keys.length; i++) {
                const key = keys[i];
                const brushRange = activeBrushes.get(key);
                if (brushRange && (y[key](d[key]) < brushRange[0] || y[key](d[key]) > brushRange[1])) {
                    isActive = false;
                    break;
                }
                context.lineTo(x(displayKeys[i]), y[key](d[key]));
            }
            
            if (isActive) {
                context.strokeStyle = color(d[currentColorKey]);
                context.globalAlpha = 0.5;
            } else {
                context.strokeStyle = '#ddd';
                context.globalAlpha = 0.1;
            }
            context.stroke();
        });
    }

    // Legend setup
    const legendWidth = 160;
    const legendHeight = 10;
    
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${width + margin.right - legendWidth - 10}, ${height})`);

    function updateLegend() {
        legendGroup.selectAll("*").remove();
        
        const legendSvg = Legend(color, {
            title: getDisplayName(currentColorKey),
            width: legendWidth,
            height: legendHeight,
            marginTop: 0,
            marginRight: 10,
            marginBottom: 0,
            marginLeft: 10,
            ticks: 4
        });

        legendGroup.append(() => legendSvg);
    }

    // Initial legend creation
    updateLegend();

    // Initial draw
    drawLines(data);

    function updateParallelCoordinates(updatedData) {
        data = updatedData;
        
        // Update scales
        for (let key of keys) {
            if (key === 'temperature') {
                y[key].domain([
                    d3.min(data.filter(d => +d[key] !== -999.0), d => +d[key]),
                    d3.max(data, d => +d[key])
                ]);
            } else if (key === 'fertility_rate') {
                y[key].domain([0, d3.max(data, d => +d[key])]);
            } else {
                y[key].domain(d3.extent(data, d => +d[key]));
            }
        }

        // Update color scale
        color = getColorScale(currentColorKey);

        // Update legend
        updateLegend();

        // Update axes
        svg.selectAll(".axis")
            .each(function(d) {
                d3.select(this).call(d3.axisLeft().scale(y[d]));
            });

        // Redraw lines
        drawLines(data);
    }

    // Subscribe to updates
    LinkedCharts.subscribe('yearRange', handleYearRangeUpdate);
    LinkedCharts.subscribe('dataUpdate', handleDataUpdate);

    function handleYearRangeUpdate(yearRange) {
        const { startYear, endYear, selectedYear } = yearRange;
        const filteredData = initialData.filter(d => {
            const dataYear = parseInt(d.year);
            return selectedYear !== null
                ? dataYear === parseInt(selectedYear)
                : dataYear >= parseInt(startYear) && dataYear <= parseInt(endYear);
        });
        updateParallelCoordinates(filteredData);
    }

    function handleDataUpdate(newData) {
        initialData = newData;
        updateParallelCoordinates(newData);
    }
}
