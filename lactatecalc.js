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

  // Calculate the Lactate Concentration at Load = 4
  let lactateThresholdLoad = findLactateThresholdLoad(coefficients, 4);

  // Calculate the DMAX point
  let dmaxLoad = calculateDMAX(coefficients);

  // Calculate the DMAX MOD point
  let dmaxModLoad = calculateDMAXMOD(coefficients, dataPoints);

  // Plot Lactate Threshold (Load at Lactate Concentration = 4)
  chart.data.datasets.push({
    label: 'Lactate Threshold',
    borderColor: 'green',
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 5,
    data: [{ x: lactateThresholdLoad, y: 4 }],
    pointBackgroundColor: 'green',
    pointBorderColor: 'green'
  });

  // Plot DMAX (Max Perpendicular Distance)
  chart.data.datasets.push({
    label: 'DMAX',
    borderColor: 'orange',
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 5,
    data: [{ x: dmaxLoad, y: 0 }],
    pointBackgroundColor: 'orange',
    pointBorderColor: 'orange'
  });

  // Plot DMAX MOD (Modified DMAX)
  chart.data.datasets.push({
    label: 'DMAX MOD',
    borderColor: 'purple',
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 5,
    data: [{ x: dmaxModLoad, y: 0 }],
    pointBackgroundColor: 'purple',
    pointBorderColor: 'purple'
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

// Calculate the DMAX point
function calculateDMAX(coefficients) {
  // Second derivative for a cubic function: ax^3 + bx^2 + cx + d
  // The second derivative is: 6ax + 2b
  let a = coefficients[0];
  let b = coefficients[1];
  
  // Find the x-value where the second derivative equals zero
  let xDMAX = -b / (3 * a);  // Solve 6ax + 2b = 0
  
  return xDMAX;
}

// Calculate the Modified DMAX point
function calculateDMAXMOD(coefficients, dataPoints) {
  // DMAX MOD method involves finding the point where the lactate concentration first increases by more than 0.4.
  for (let i = 1; i < dataPoints.length; i++) {
    if (dataPoints[i].y - dataPoints[i - 1].y > 0.4) {
      return dataPoints[i].x; // Return the corresponding load value
    }
  }
  return null;
}

// Find Lactate Threshold Load (when concentration is 4)
function findLactateThresholdLoad(coefficients, threshold) {
  let load = null;
  
  // Solve for x in polynomial equation where y = threshold (Lactate concentration)
  let a = coefficients[0];
  let b = coefficients[1];
  let c = coefficients[2];
  let d = coefficients[3];

  // Using a numerical method to find the root
  for (let x = 0; x < 1000; x += 0.1) {
    let y = a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
    if (Math.abs(y - threshold) < 0.1) {
      load = x;
      break;
    }
  }

  return load;
}

