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

// Function to calculate the distance of a point (x, y) from a line ax + by + c = 0
function pointToLineDistance(x, y, a, b, c) {
  return Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b);
}

// Function to calculate the D-max
function calculateDMax(polynomialCurve) {
  // Get the first and last points of the polynomial curve
  let firstPoint = polynomialCurve[0];
  let lastPoint = polynomialCurve[polynomialCurve.length - 1];
  
  // Calculate the line equation from the first and last points
  let x1 = firstPoint.x, y1 = firstPoint.y;
  let x2 = lastPoint.x, y2 = lastPoint.y;
  
  // Slope of the line
  let slope = (y2 - y1) / (x2 - x1);
  let intercept = y1 - slope * x1;
  
  // Line equation: y = slope * x + intercept --> Rewritten as slope * x - y + intercept = 0
  let a = slope;
  let b = -1;
  let c = intercept;
  
  // Find the point on the polynomial curve with the maximum distance to the line
  let maxDistance = 0;
  let dMaxPoint = null;
  
  for (let point of polynomialCurve) {
    let distance = pointToLineDistance(point.x, point.y, a, b, c);
    if (distance > maxDistance) {
      maxDistance = distance;
      dMaxPoint = point;
    }
  }
  
  return dMaxPoint; // The point with the maximum distance
}

// Add D-max to the updateGraph function
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

  // Polynomial regression (3rd-order) to fit a curve
  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Calculate D-max
  let dMaxPoint = calculateDMax(polynomialCurve);
  console.log("D-max Point:", dMaxPoint);

  // Display the D-max point in the UI
  document.getElementById("dmax-display").innerText = `D-max Point: x = ${dMaxPoint.x.toFixed(2)}, y = ${dMaxPoint.y.toFixed(2)}`;

  // Add D-max point to the chart data
  chart.data.datasets[2] = {
    label: 'D-max Point',
    borderColor: 'blue',
    backgroundColor: 'blue',
    pointRadius: 8,
    data: [dMaxPoint]  // Add the D-max point as a single point
  };

  // Update chart with data points and polynomial curve
  chart.data.datasets[0].data = [...dataPoints]; // Ensure black dots appear
  chart.data.datasets[1].data = [...polynomialCurve]; // Red polynomial line (smooth)

  // Update the title with the R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

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

