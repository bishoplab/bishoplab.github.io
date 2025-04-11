let chart = null;

function toggleTool() {
  let toolContainer = document.getElementById('tool-container');
  let isHidden = (toolContainer.style.display === 'none' || toolContainer.style.display === '');
  
  toolContainer.style.display = isHidden ? 'flex' : 'none';

  if (isHidden && !chart) {
    initializeGraph();
  }

  // Add a row if the tool is being shown and it's the first time
  if (isHidden && document.getElementById("data-table").getElementsByTagName('tbody')[0].children.length === 0) {
    addRow();
  }
}

function addRow() {
  let table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  let newRow = table.insertRow();
  let cell1 = newRow.insertCell(0);
  let cell2 = newRow.insertCell(1);
  
  cell1.innerHTML = '<input type="number" step="any" oninput="updateGraph()">'; 
  cell2.innerHTML = '<input type="number" step="any" oninput="updateGraph()">'; 
}

function initializeGraph() {
  let ctx = document.getElementById('lactateChart').getContext('2d');

  chart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Data Points',
        borderColor: 'transparent', // No line connecting data points
        backgroundColor: 'black',
        pointRadius: 5,
        data: [] // Start empty, but will be populated with the points
      }, {
        label: 'Line of Best Fit',
        borderColor: 'red',
        backgroundColor: 'transparent',
        fill: false,
        showLine: true,
        tension: 0, // No smoothing for a straight line
        borderWidth: 2,
        pointRadius: 0, // No points on the curve
        data: [] // Polynomial curve data, initially empty
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1, // Set aspect ratio to 1 to prevent stretching
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }, // Disable tooltip as it's not needed for this chart
        title: {
          display: true,
          text: 'Lactate Threshold Curve (R²: )',
          font: {
            size: 16
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Load' }, min: 0 },
        y: { title: { display: true, text: 'Lactate Concentration' }, min: 0 }
      }
    }
  });
}

function updateGraph() {
  if (!chart) return;

  let table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  let rows = table.getElementsByTagName('tr');

  let dataPoints = [];

  for (let row of rows) {
    let inputs = row.getElementsByTagName('input');
    let x = parseFloat(inputs[0].value);
    let y = parseFloat(inputs[1].value);

    if (!isNaN(x) && !isNaN(y)) {
      dataPoints.push({ x, y });
    }
  }

  console.log("Data Points:", dataPoints); // Debugging output

  if (dataPoints.length === 0) return;

  dataPoints.sort((a, b) => a.x - b.x); // Sort by x-value for the curve fitting

  // Polynomial regression (1st-order for line of best fit) to fit a curve
  let coefficients = linearRegression(dataPoints);
  let bestFitLine = generateBestFitLine(coefficients, dataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, bestFitLine);

  // Update chart with data points and polynomial curve
  chart.data.datasets[0].data = [...dataPoints]; // Ensure black dots appear
  chart.data.datasets[1].data = [...bestFitLine]; // Red line of best fit

  // Update the title with the R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  chart.update();
}

// Linear Regression (1st-order)
function linearRegression(points) {
  let xValues = points.map(p => p.x);
  let yValues = points.map(p => p.y);

  let n = points.length;
  let sumX = xValues.reduce((sum, x) => sum + x, 0);
  let sumY = yValues.reduce((sum, y) => sum + y, 0);
  let sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  let sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

  // Calculate slope (m) and intercept (b) for y = mx + b
  let m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  let b = (sumY - m * sumX) / n;

  return [m, b]; // Return the coefficients [m, b]
}

// Generate y-values for the best fit line based on the slope and intercept
function generateBestFitLine(coefficients, points) {
  return points.map(point => {
    let y = coefficients[0] * point.x + coefficients[1]; // y = mx + b
    return { x: point.x, y: y };
  });
}

// Calculate R² value for the regression
function calculateRSquared(points, bestFitLine) {
  let meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  let ssResidual = points.reduce((sum, p, i) => sum + Math.pow(p.y - bestFitLine[i].y, 2), 0);
  return 1 - (ssResidual / ssTotal);
}

