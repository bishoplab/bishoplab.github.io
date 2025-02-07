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
          font: { size: 16 }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Load' }, min: 0 },
        y: { title: { display: true, text: 'Lactate Concentration' }, min: 0 }
      }
    }
  });
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

// Update the findMaxPerpendicularDistance function to return the closest point on the full polynomial curve
function findMaxPerpendicularDistance(polynomialCurve, firstPoint, lastPoint) {
  let maxDistance = 0;
  let perpendicularX = null;

  // Calculate slope and intercept for the line connecting the first and last data points
  let slope = (lastPoint.y - firstPoint.y) / (lastPoint.x - firstPoint.x);
  let intercept = firstPoint.y - (slope * firstPoint.x);

  // Iterate over the polynomial curve to calculate the perpendicular distance at each point
  for (let i = 0; i < polynomialCurve.length; i++) {
    let point = polynomialCurve[i];
    let x0 = point.x;
    let y0 = point.y;

    // Calculate the perpendicular distance from the point to the line using the distance formula
    let distance = Math.abs(slope * x0 - y0 + intercept) / Math.sqrt(slope * slope + 1);

    // If the calculated perpendicular distance is greater than the current max distance, update it
    if (distance > maxDistance) {
      maxDistance = distance;
      perpendicularX = point.x; // Store the x-coordinate of the max distance
    }
  }

  // Find the corresponding y-value on the polynomial curve by evaluating the polynomial at perpendicularX
  let closestPointOnCurve = {
    x: perpendicularX,
    y: evaluatePolynomialAtX(polynomialCurve, perpendicularX)
  };

  return closestPointOnCurve;
}

// Function to evaluate the polynomial at a given x-value using the coefficients
function evaluatePolynomialAtX(coefficients, x) {
  let y = 0;
  for (let i = 0; i < coefficients.length; i++) {
    y += coefficients[i] * Math.pow(x, coefficients.length - 1 - i);
  }
  return y;
}

function displayTextBelowGraph(point) {
  let textContainer = document.getElementById("closest-point-text");

  if (!textContainer) {
    textContainer = document.createElement("div");
    textContainer.id = "closest-point-text";
    document.body.appendChild(textContainer);
  }

  textContainer.innerHTML = `Closest point on curve: X = ${point.x.toFixed(2)}, Y = ${point.y.toFixed(2)}`;
}

function updateGraph() {
  if (!chart) return;

  let table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  let rows = table.getElementsByTagName('tr');

  let dataPoints = [];

  // Extract values from the table and store them as data points
  for (let row of rows) {
    let inputs = row.getElementsByTagName('input');
    let x = parseFloat(inputs[0].value);
    let y = parseFloat(inputs[1].value);

    if (!isNaN(x) && !isNaN(y)) {
      dataPoints.push({ x, y });
    }
  }

  // If no valid data points, do nothing
  if (dataPoints.length === 0) return;

  // Sort data points by x value
  dataPoints.sort((a, b) => a.x - b.x);

  // Perform polynomial regression to get the curve
  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  // Calculate R² value for the regression
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Find the maximum perpendicular distance and its corresponding point on the polynomial curve
  let closestPointOnCurve = findMaxPerpendicularDistance(polynomialCurve, dataPoints[0], dataPoints[dataPoints.length - 1]);

  // Update the chart with the new data points and polynomial curve
  chart.data.datasets[0].data = dataPoints; // Update black dots dataset
  chart.data.datasets[1].data = polynomialCurve; // Update polynomial curve dataset

  // Update chart title with R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Add annotation to display closest point's x and y values to the right of the graph
  chart.options.plugins.annotation = {
    annotations: {
      closestPointAnnotation: {
        type: 'label',
        xValue: chart.scales.x.max * 1.05, // Place annotation to the right of the graph
        yValue: closestPointOnCurve.y,
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: '#ffffff',
        font: {
          size: 12
        },
        label: `X: ${closestPointOnCurve.x.toFixed(2)}, Y: ${closestPointOnCurve.y.toFixed(2)}`
      }
    }
  };

  // Finally, update the chart to reflect all changes
  chart.update();
}  
