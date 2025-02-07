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
        label: 'Polynomial Fit',
        borderColor: 'red',
        backgroundColor: 'transparent',
        fill: false,
        showLine: true,
        tension: 0.4, // Smooth the line (non-zero value for smooth curve)
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

  if (dataPoints.length === 0) return;

  dataPoints.sort((a, b) => a.x - b.x); // Sort by x-value

  // Perform polynomial regression (3rd-order)
  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Find the perpendicular distance and its x-value
  let { maxDistance, perpendicularX } = findMaxPerpendicularDistance(dataPoints, polynomialCurve);

  // Update chart with data points and polynomial curve
  chart.data.datasets[0].data = [...dataPoints]; // Black dots
  chart.data.datasets[1].data = [...polynomialCurve]; // Red polynomial line

  // Update the title with R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Ensure text displays on the chart
  displayTextOnChart(perpendicularX, maxDistance);

  chart.update();
}

// Function to find the max perpendicular distance and its x-coordinate
function findMaxPerpendicularDistance(dataPoints, polynomialCurve) {
  let firstPoint = dataPoints[0];
  let lastPoint = dataPoints[dataPoints.length - 1];

  // Equation of the linear line y = mx + b
  let slope = (lastPoint.y - firstPoint.y) / (lastPoint.x - firstPoint.x);
  let intercept = firstPoint.y - slope * firstPoint.x;

  let maxDistance = 0;
  let perpendicularX = null;

  for (let point of polynomialCurve) {
    let x0 = point.x;
    let y0 = point.y;

    // Distance formula from point (x0, y0) to the line y = mx + b
    let distance = Math.abs(slope * x0 - y0 + intercept) / Math.sqrt(slope ** 2 + 1);

    if (distance > maxDistance) {
      maxDistance = distance;
      perpendicularX = x0;
    }
  }

  return { maxDistance, perpendicularX };
}

// Function to display text on the chart
function displayTextOnChart(xValue, maxDistance) {
  let ctx = chart.ctx;
  
  // Convert the xValue to chart pixel position
  let xPos = chart.scales.x.getPixelForValue(xValue);
  let yPos = chart.scales.y.getPixelForValue(maxDistance); // Optional: Place y position based on distance
  
  // Customize text appearance and position
  ctx.save();
  ctx.font = "14px Arial";
  ctx.fillStyle = "blue";
  ctx.fillText(`Max Perpendicular X: ${xValue.toFixed(2)}`, xPos + 10, yPos - 10); // Adjust positioning
  ctx.restore();
}



// Polynomial Regression (3rd-order)
function polynomialRegression(points, degree) {
  let xValues = points.map(p => p.x);
  let yValues = points.map(p => p.y);
  
  // Constructing the Vandermonde matrix (X matrix) and the Y vector
  let X = [];
  for (let i = 0; i < points.length; i++) {
    X[i] = [];
    for (let j = 0; j <= degree; j++) {
      X[i][j] = Math.pow(xValues[i], degree - j);
    }
  }
  
  // Solving for the polynomial coefficients using least squares
  let Xt = math.transpose(X);
  let XtX = math.multiply(Xt, X);
  let XtY = math.multiply(Xt, yValues);
  let coefficients = math.lusolve(XtX, XtY);

  return coefficients;
}

// Generate y-values for the polynomial curve based on the fitted coefficients
function generatePolynomialCurve(coefficients, points) {
  return points.map(point => {
    let y = 0;
    for (let i = 0; i < coefficients.length; i++) {
      y += coefficients[i] * Math.pow(point.x, coefficients.length - 1 - i);
    }
    return { x: point.x, y: y };
  });
}

// Calculate R² value for the regression
function calculateRSquared(points, polynomialCurve) {
  let meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  let ssResidual = points.reduce((sum, p, i) => sum + Math.pow(p.y - polynomialCurve[i].y, 2), 0);
  return 1 - (ssResidual / ssTotal);
}
