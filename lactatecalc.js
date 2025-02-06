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

  for (let row of rows) {
    let inputs = row.getElementsByTagName('input');
    let x = parseFloat(inputs[0].value);
    let y = parseFloat(inputs[1].value);

    if (!isNaN(x) && !isNaN(y)) {
      dataPoints.push({ x, y });
    }
  }

  dataPoints.sort((a, b) => a.x - b.x); // Sort by x-value for the curve fitting

  // Polynomial regression (3rd-order) to fit a curve
  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Update chart with data points and polynomial curve
  chart.data.datasets[0].data = dataPoints; // Add data points
  chart.data.datasets[1].data = polynomialCurve; // Add polynomial fit curve

  // Update the title with the R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Calculate the three lactate threshold methods
  let polynomialThresholdLoad = calculatePolynomialThreshold(coefficients);
  let dmaxLoad = calculateDmax(coefficients, dataPoints);
  let dmaxModLoad = calculateDmaxMod(coefficients, dataPoints);

  // Add a dotted line at the Modified Dmax Load
  let modifiedDmax = calculateModifiedDmax(coefficients);
  let modifiedDmaxY = evaluatePolynomial(coefficients, modifiedDmax);

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

  // Display lactate threshold load values under the graph
  document.getElementById("lactate-thresholds").innerHTML = `
    Polynomial Threshold Load: ${polynomialThresholdLoad.toFixed(2)}<br>
    DMAX Threshold Load: ${dmaxLoad.toFixed(2)}<br>
    DMAX MOD Threshold Load: ${dmaxModLoad.toFixed(2)}
  `;
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
  
  // Find the x-value where the second derivative equals zero
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

// Calculate the polynomial threshold (lactate concentration = 4)
function calculatePolynomialThreshold(coefficients) {
  let thresholdY = 4;
  let thresholdX = solvePolynomialForY(coefficients, thresholdY);
  return thresholdX;
}

// Solve polynomial equation for a specific y-value
function solvePolynomialForY(coefficients, yValue) {
  let left = 0;
  let right = 100; // Arbitrary range, adjust as necessary
  let tolerance = 0.001;
  let x = (left + right) / 2;

  while (Math.abs(evaluatePolynomial(coefficients, x) - yValue) > tolerance) {
    if (evaluatePolynomial(coefficients, x) < yValue) {
      left = x;
    } else {
      right = x;
    }
    x = (left + right) / 2;
  }

  return x;
}

// Calculate DMAX (Max Perpendicular Distance)
function calculateDmax(coefficients, dataPoints) {
  // Calculate perpendicular distance from each point to the line formed by the first and last points
  let startX = dataPoints[0].x;
  let startY = dataPoints[0].y;
  let endX = dataPoints[dataPoints.length - 1].x;
  let endY = dataPoints[dataPoints.length - 1].y;

  let maxDistance = 0;
  let dmaxX = 0;

  for (let point of dataPoints) {
    let distance = perpendicularDistance(startX, startY, endX, endY, point.x, point.y);
    if (distance > maxDistance) {
      maxDistance = distance;
      dmaxX = point.x;
    }
  }

  return dmaxX;
}

// Perpendicular distance between a point and a line
function perpendicularDistance(x1, y1, x2, y2, x, y) {
  return Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
}

// Calculate DMAX MOD (Modified DMAX)
function calculateDmaxMod(coefficients, dataPoints) {
  let threshold = 0.4;
  let breakPoint = 0;

  for (let i = 1; i < dataPoints.length; i++) {
    if (dataPoints[i].y - dataPoints[i - 1].y > threshold) {
      breakPoint = i;
      break;
    }
  }

  let startX = dataPoints[breakPoint - 1].x;
  let startY = dataPoints[breakPoint - 1].y;
  let endX = dataPoints[dataPoints.length - 1].x;
  let endY = dataPoints[dataPoints.length - 1].y;

  let maxDistance = 0;
  let dmaxModX = 0;

  for (let point of dataPoints.slice(breakPoint)) {
    let distance = perpendicularDistance(startX, startY, endX, endY, point.x, point.y);
    if (distance > maxDistance) {
      maxDistance = distance;
      dmaxModX = point.x;
    }
  }

  return dmaxModX;
}

