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
  chart.options.plugins.title.text = Lactate Threshold Curve (R²: ${rSquared.toFixed(4)});

  // Calculate the Modified Dmax point (Load at the Dmax point)
  let modifiedDmax = calculateModifiedDmax(coefficients);

  // Calculate the y-value for the Modified Dmax Load
  let modifiedDmaxY = evaluatePolynomial(coefficients, modifiedDmax);

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
  // Second derivative for a cubic function: ax^3 + bx^2 + cx + d
  // The second derivative is: 6ax + 2b
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

  // Calculate the three methods for lactate threshold determination
  let lactateThreshold = findLactateThreshold(coefficients, 4);  // Load at lactate concentration of 4
  let dmax = calculateDMAX(coefficients, dataPoints);
  let dmaxMod = calculateDMAXMOD(coefficients, dataPoints);

  // Display the results to the right of the graph
  document.getElementById("lactate-threshold-value").innerText = `Lactate Threshold Load: ${lactateThreshold.toFixed(2)} (Load at y=4)`;
  document.getElementById("dmax-value").innerText = `DMAX Load: ${dmax.toFixed(2)} (Max Perpendicular Distance)`;
  document.getElementById("dmax-mod-value").innerText = `DMAX MOD Load: ${dmaxMod.toFixed(2)} (Modified DMAX)`;

  chart.update();
}

// Function to find the lactate threshold (4 on the polynomial curve)
function findLactateThreshold(coefficients, thresholdValue) {
  // Use a root-finding method or an interpolation technique to find the x where the polynomial equals thresholdValue
  let xLow = 0;
  let xHigh = 10; // Assumed range, adjust as necessary
  let epsilon = 0.01;

  while (xHigh - xLow > epsilon) {
    let xMid = (xLow + xHigh) / 2;
    let y = evaluatePolynomial(coefficients, xMid);

    if (y < thresholdValue) {
      xLow = xMid;
    } else {
      xHigh = xMid;
    }
  }

  return (xLow + xHigh) / 2;
}

// Function to calculate DMAX (Max Perpendicular Distance from the line)
function calculateDMAX(coefficients, dataPoints) {
  let lineStart = dataPoints[0]; // First data point
  let lineEnd = dataPoints[dataPoints.length - 1]; // Last data point
  let maxDistance = -Infinity;
  let maxX = 0;

  // Check perpendicular distance from polynomial curve to the line formed by the first and last data points
  for (let point of dataPoints) {
    let distance = perpendicularDistance(lineStart, lineEnd, point);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxX = point.x;
    }
  }

  return maxX;
}

// Function to calculate DMAX MOD (Modified DMAX)
function calculateDMAXMOD(coefficients, dataPoints) {
  let modifiedLineStart = null;
  let modifiedLineEnd = null;

  for (let i = 0; i < dataPoints.length - 1; i++) {
    if (Math.abs(dataPoints[i + 1].y - dataPoints[i].y) > 0.4) {
      modifiedLineStart = dataPoints[i];
      modifiedLineEnd = dataPoints[i + 1];
      break;
    }
  }

  let maxDistance = -Infinity;
  let maxX = 0;

  // Check perpendicular distance from polynomial curve to the modified line
  for (let point of dataPoints) {
    if (modifiedLineStart && modifiedLineEnd) {
      let distance = perpendicularDistance(modifiedLineStart, modifiedLineEnd, point);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxX = point.x;
      }
    }
  }

  return maxX;
}

// Function to calculate the perpendicular distance from a point to a line
function perpendicularDistance(lineStart, lineEnd, point) {
  let numerator = Math.abs((lineEnd.y - lineStart.y) * point.x - (lineEnd.x - lineStart.x) * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  let denominator = Math.sqrt(Math.pow(lineEnd.y - lineStart.y, 2) + Math.pow(lineEnd.x - lineStart.x, 2));
  return numerator / denominator;
}
