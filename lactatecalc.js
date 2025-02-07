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

function findMaxPerpendicularDistance(polynomialCurve) {
  let maxDistance = 0;
  let perpendicularX = null;

  // Iterate over the polynomial curve to calculate the perpendicular distance at each point
  for (let i = 0; i < polynomialCurve.length; i++) {
    let point = polynomialCurve[i];
    let x0 = point.x;
    let y0 = point.y;

    // Calculate the perpendicular distance from the point to the curve. 
    // We can do this by finding the closest x-coordinate to the point and its corresponding y-value.
    let closestPoint = findClosestPointOnCurve(polynomialCurve, x0);
    let distance = Math.abs(y0 - closestPoint.y);

    // If the calculated perpendicular distance is greater than the current max distance, update it
    if (distance > maxDistance) {
      maxDistance = distance;
      perpendicularX = closestPoint.x; // Store the x-coordinate of the max distance
    }
  }

  return { maxDistance, perpendicularX };
}

// Helper function to find the closest point on the polynomial curve for a given x value
function findClosestPointOnCurve(curve, x) {
  let closestPoint = null;
  let minDistance = Infinity;

  for (let point of curve) {
    let distance = Math.abs(point.x - x);
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
    }
  }

  return closestPoint;
}

// Function to display text on the chart
function displayTextBelowGraph(closestPoint) {
  // Create the text element if it doesn't already exist
  let textElement = document.getElementById("loadText");

  // If the text element is missing, create and append it
  if (!textElement) {
    textElement = document.createElement("div");
    textElement.id = "loadText";
    textElement.style.marginTop = "20px"; // Space below the chart
    textElement.style.fontSize = "14px"; // Adjust font size as needed
    textElement.style.color = "#333"; // Text color
    document.getElementById('tool-container').appendChild(textElement);
  }

  // Update the text content with the closest point's x and y values
  textElement.innerHTML = `Closest Point: x = ${closestPoint.x.toFixed(2)}, y = ${closestPoint.y.toFixed(2)}`;
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

  // Find the maximum perpendicular distance and its corresponding x value from the polynomial curve
  let { maxDistance, perpendicularX } = findMaxPerpendicularDistance(polynomialCurve);

  // Find the closest point on the polynomial curve to the x value where the max perpendicular distance occurred
  let closestPoint = findClosestPointOnCurve(polynomialCurve, perpendicularX);

  // Update the chart with the new data points and polynomial curve
  chart.data.datasets[0].data = dataPoints; // Update black dots dataset
  chart.data.datasets[1].data = polynomialCurve; // Update polynomial curve dataset

  // Update chart title with R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Update the text below the chart with the closest point's x and y values
  displayTextBelowGraph(closestPoint);

  // Finally, update the chart to reflect all changes
  chart.update();
}


