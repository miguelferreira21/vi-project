const REFERENCE_WIDTH = 2560;  
const REFERENCE_HEIGHT = 1440; 

let scaleFactor = 1;

function calculateScaleFactor() {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  const widthRatio = windowWidth / REFERENCE_WIDTH;
  const heightRatio = windowHeight / REFERENCE_HEIGHT;
  
  // Use the smaller ratio to ensure everything fits on the screen
  scaleFactor = Math.min(widthRatio, heightRatio);
}

function scaleValue(value) {
  return value * scaleFactor;
}

function handleResize() {
  calculateScaleFactor();
  
  // Update LineChart
  updateLineChartSize();

  // Update ChoroplethMap
  updateChoroplethMapSize();

  // Update RooftopMatrix
  updateRooftopMatrixSize();

  // Update ParallelCoordinates (when implemented)
  // updateParallelCoordinatesSize();
}

// Initial calculation
calculateScaleFactor();

// Add event listener for window resize
window.addEventListener('resize', handleResize);