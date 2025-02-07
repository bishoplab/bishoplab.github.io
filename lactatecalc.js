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

  if (dataPoints.length < 2) return; // Ensure we have at least two points

  dataPoints.sort((a, b) => a.x - b.x); // Sort by x-value for curve fitting

  // Get first and last points (lowest and highest Load values)
  let firstPoint = dataPoints[0];
  let lastPoint = dataPoints[dataPoints.length - 1];

  // Compute polynomial regression (3rd-order)
  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Find max perpendicular distance and intersection point
  let maxPerpendicularPoint = findMaxPerpendicularDistance(firstPoint, lastPoint, polynomialCurve);

  // Update chart with data points, polynomial curve, and annotation
  chart.data.datasets[0].data = [...dataPoints]; // Data points
  chart.data.datasets[1].data = [...polynomialCurve]; // Polynomial curve

  // Update the title with the R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Add text annotation for the Load value at max perpendicular distance
  chart.options.plugins.annotation = {
    annotations: [
      {
        type: 'label',
        xValue: maxPerpendicularPoint.x,
        yValue: maxPerpendicularPoint.y,
        backgroundColor: 'rgba(255,0,0,0.7)',
        content: `Load: ${maxPerpendicularPoint.x.toFixed(2)}`,
        font: { size: 14 },
        position: 'top'
      }
    ]
  };

  chart.update();
}

// Function to find max perpendicular distance between the polynomial and the linear line
function findMaxPerpendicularDistance(firstPoint, lastPoint, polynomialCurve) {
  let x1 = firstPoint.x, y1 = firstPoint.y;
  let x2 = lastPoint.x, y2 = lastPoint.y;

  // Compute line equation y = mx + b
  let m = (y2 - y1) / (x2 - x1);
  let b = y1 - m * x1;

  let maxDistance = 0;
  let maxPoint = null;

  for (let point of polynomialCurve) {
    let x0 = point.x;
    let y0 = point.y;

    // Perpendicular distance formula
    let distance = Math.abs(m * x0 - y0 + b) / Math.sqrt(m * m + 1);

    if (distance > maxDistance) {
      maxDistance = distance;
      maxPoint = { x: x0, y: y0 };
    }
  }

  return maxPoint;
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
