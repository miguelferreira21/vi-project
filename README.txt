What's the Secret to Happiness? - Interactive Data Visualization
=================================================

This project is an interactive visualization dashboard exploring happiness data across different countries and metrics.
It combines multiple visualization idioms including a choropleth map, parallel coordinates, line chart, and matrix visualization to provide comprehensive insights into global happiness patterns and statistics.

Requirements
-----------
- Modern web browser (Chrome, Firefox, Safari, or Edge) 
- Local server capability (VS Code Live Server, Python HTTP server, or similar)
- No internet connection required after initial setup
- No additional installations needed

Project Structure
---------------
/data           - Contains JSON, CSV, and geographic data files
/filters        - Filter components for data interaction
/idioms         - Individual visualization components
/lib            - Required libraries (D3.js v7 and utilities)
/placeholders   - Image assets used in the project

Libraries Used (All Included)
---------------------------
- D3.js (v7)
- TopoJSON Client
- D3 Simple Slider
- SweetAlert2

Running the Dashboard
-------------------
There are several ways to run the project using a local server:

1. Using VS Code Live Server:
   - Install Live Server extension in VS Code
   - Right-click on index.html
   - Select "Open with Live Server"

2. Using Python HTTP Server:
   - Open terminal in project directory
   - Python 3: python -m http.server 8000
   - Python 2: python -m SimpleHTTPServer 8000
   - Open browser and navigate to http://localhost:8000

3. Using Node.js http-server:
   - Install: npm install -g http-server
   - Run: http-server
   - Open browser and navigate to http://localhost:8080

Choose any of the above methods - they all work equally well. The visualization will be accessible through your web browser at the local address provided by your chosen server method.

Note: The project is completely self-contained and requires no internet connection or additional installations beyond the local server. All necessary libraries and data files are included in the project directory.
