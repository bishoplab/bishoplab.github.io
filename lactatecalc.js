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
      datasets: [
        {
          label: 'Data Points',
          borderColor: 'black',
          backgroundColor: 'black',
          fill: false,
          showLine: false, // Points only
          pointRadius: 5,
          data: [] // Initially empty, will be filled with data points
        },
        {
          label: 'Polynomial Fit',
          borderColor: 'red',
          backgroundColor: 'transparent',
          fill: false,
          showLine: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0, // No points for the polynomial curve
          data: [] // Polynomial curve data
        }
      ]
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

  // Gather data points from the table and filter out unrealistic values
  for (let row of rows) {
    let inputs = row.getElementsByTagName('input');
    let x = parseFloat(inputs[0].value);
    let y = parseFloat(inputs[1].value);

    if (!isNaN(x) && !isNaN(y) && y <= 12) {  // Set a cap to filter extreme values (e.g., y <= 12)
      dataPoints.push({ x, y });
    }
  }

  dataPoints.sort((a, b) => a.x - b.x); // Sort by x-value for the curve fitting

  if (dataPoints.length < 2) return; // Ensure at least two points for fitting

  // Normalize the y-values before fitting to prevent large values from causing issues
  let maxY = Math.max(...dataPoints.map(p => p.y));
  let minY = Math.min(...dataPoints.map(p => p.y));
  let rangeY = maxY - minY;
  let normalizedDataPoints = dataPoints.map(p => ({
    x: p.x,
    y: (p.y - minY) / rangeY  // Normalize y-values between 0 and 1
  }));

  // Polynomial regression (3rd-order) to fit a curve
  let coefficients = polynomialRegression(normalizedDataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, normalizedDataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(normalizedDataPoints, polynomialCurve);

  // Update chart with data points and polynomial curve
  chart.data.datasets[0].data = dataPoints; // Add data points
  chart.data.datasets[1].data = polynomialCurve; // Add polynomial fit curve

  // Update the title with the R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Calculate the Lactate Threshold (where y = 4)
  let lactateThreshold = findLactateThreshold(coefficients, 4);
  document.getElementById('lactate-threshold-value').textContent = `Lactate Threshold: Load = ${lactateThreshold.toFixed(2)}`;

  // Calculate DMAX
  let dmax = calculateDMAX(coefficients, normalizedDataPoints);
  document.getElementById('dmax-value').textContent = `DMAX: Load = ${dmax.toFixed(2)}`;

  // Calculate Modified DMAX
  let modifiedDmax = calculateModifiedDmax(coefficients);
  let modifiedDmaxY = evaluatePolynomial(coefficients, modifiedDmax);
  document.getElementById('modified-dmax-value').textContent = `Modified DMAX: Load = ${modifiedDmax.toFixed(2)}`;

  // Add a dotted line at the Modified Dmax Load
  chart.data.datasets.push({
    label: 'Modified Dmax Line',
    borderColor: 'blue',
    backgroundColor: 'transparent',
    borderDash: [5, 5], // Dotted line style
    fill: false,
    data: [{ x: modifiedDmax, y: 0 }, { x: modifiedDmax, y: modifiedDmaxY }],
    pointRadius: 0
  });

  chart.update();
}

// Helper function to generate the polynomial curve only within the bounds of the input data
function generatePolynomialCurve(coefficients, dataPoints, xMin, xMax) {
  let step = (xMax - xMin) / 100;  // Define the number of points for the curve
  let curve = [];
  for (let i = xMin; i <= xMax; i += step) {
    let normalizedY = evaluatePolynomial(coefficients, i);
    let realY = normalizedY * (Math.max(...dataPoints.map(p => p.y)) - Math.min(...dataPoints.map(p => p.y))) + Math.min(...dataPoints.map(p => p.y));
    curve.push({ x: i, y: realY });
  }
  return curve;
}

// Polynomial evaluation function (for normalized values)
function evaluatePolynomial(coefficients, x) {
  return coefficients.reduce((acc, coeff, index) => acc + coeff * Math.pow(x, coefficients.length - index - 1), 0);
}

// Find the x-value where the polynomial curve equals a specific y-value (e.g., 4 for Lactate Threshold)
function findLactateThreshold(coefficients, targetY) {
  // Find the x-value where the polynomial curve equals the target Y value
  let xLow = Math.min(...dataPoints.map(p => p.x));  // Set the lower bound to the smallest x value
  let xHigh = Math.max(...dataPoints.map(p => p.x)); // Set the upper bound to the largest x value
  let tolerance = 0.001;

  while (xHigh - xLow > tolerance) {
    let xMid = (xLow + xHigh) / 2;
    let yMid = evaluatePolynomial(coefficients, xMid);

    if (yMid < targetY) {
      xLow = xMid; // Move the lower bound up
    } else {
      xHigh = xMid; // Move the upper bound down
    }
  }

  return (xLow + xHigh) / 2;
}

// Calculate the DMAX point (Max perpendicular distance to the straight line formed by first and last data points)
function calculateDMAX(coefficients, dataPoints) {
  let firstPoint = dataPoints[0];
  let lastPoint = dataPoints[dataPoints.length - 1];

  let slope = (lastPoint.y - firstPoint.y) / (lastPoint.x - firstPoint.x);
  let intercept = firstPoint.y - slope * firstPoint.x;

  let maxDistance = 0;
  let dmaxX = 0;

  for (let point of dataPoints) {
    let yLine = slope * point.x + intercept;
    let distance = Math.abs(point.y - yLine) / Math.sqrt(1 + Math.pow(slope, 2));

    if (distance > maxDistance) {
      maxDistance = distance;
      dmaxX = point.x;
    }
  }

  return dmaxX;
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

// Calculate the second derivative of the polynomial and find its maximum (Modified Dmax)
function calculateModifiedDmax(coefficients) {
  let a = coefficients[0];
  let b = coefficients[1];
  
  let xModifiedDmax = -b / (3 * a);  // Solve 6ax + 2b = 0
  
  return xModifiedDmax;
}

// Evaluate polynomial at x value
function evaluatePolynomial(coefficients, x) {
  let y = 0;
  for (let i = 0; i < coefficients.length; i++) {
    y += coefficients[i] * Math.pow(x, coefficients.length - 1 - i);
  }
  return y;
}

