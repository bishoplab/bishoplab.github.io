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
    type: 'line', // Changed from 'scatter' to 'line' to ensure no dots are plotted
    data: {
      datasets: [{
        label: 'Polynomial Fit',
        borderColor: 'red',
        backgroundColor: 'transparent',
        fill: false,
        showLine: true,
        tension: 0, // No bezier curves, just straight lines
        borderWidth: 2,
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

  dataPoints.sort((a, b) => a.x - b.x); // Sort by x-value for the curve fitting

  // Polynomial regression (3rd-order) to fit a curve
  let coefficients = polynomialRegression(dataPoints, 3);
  
  // Generate a smooth polynomial curve by interpolating between the data points
  let polynomialCurve = generateSmoothedPolynomialCurve(coefficients, dataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Update chart with polynomial curve only (no dots)
  chart.data.datasets[0].data = polynomialCurve; // Red polynomial line

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

// Generate smoothed y-values for the polynomial curve based on the fitted coefficients
function generateSmoothedPolynomialCurve(coefficients, points) {
  // Generate x-values for a smooth curve
  let xMin = Math.min(...points.map(p => p.x));
  let xMax = Math.max(...points.map(p => p.x));
  let smoothXValues = [];
  
  // Creating more points between xMin and xMax to smooth the curve
  for (let i = 0; i <= 100; i++) {
    smoothXValues.push(xMin + (xMax - xMin) * i / 100);
  }

  return smoothXValues.map(x => {
    let y = 0;
    for (let i = 0; i < coefficients.length; i++) {
      y += coefficients[i] * Math.pow(x, coefficients.length - 1 - i);
    }
    return { x: x, y: y };
  });
}

// Calculate R² value for the regression
function calculateRSquared(points, polynomialCurve) {
  let meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  let ssResidual = points.reduce((sum, p, i) => sum + Math.pow(p.y - polynomialCurve[i].y, 2), 0);
  return 1 - (ssResidual / ssTotal);
}


