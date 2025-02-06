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
        },
        annotation: {
          annotations: [] // To be populated with text annotations for Lactate Threshold, DMAX, DMAX MOD
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

  // Calculate the Lactate Threshold at concentration = 4
  let lactateThreshold = calculateLactateThreshold(coefficients, 4);

  // Calculate DMAX
  let dmax = calculateDmax(coefficients, dataPoints);

  // Add annotations for Lactate Threshold, DMAX, and DMAX MOD
  chart.data.datasets.push({
    label: 'Lactate Threshold',
    borderColor: 'green',
    backgroundColor: 'transparent',
    borderDash: [],
    fill: false,
    data: [{ x: lactateThreshold, y: 4 }],
    pointRadius: 0
  });

  chart.data.datasets.push({
    label: 'DMAX',
    borderColor: 'orange',
    backgroundColor: 'transparent',
    borderDash: [],
    fill: false,
    data: [{ x: dmax, y: evaluatePolynomial(coefficients, dmax) }],
    pointRadius: 0
  });

  chart.data.datasets.push({
    label: 'DMAX MOD',
    borderColor: 'purple',
    backgroundColor: 'transparent',
    borderDash: [],
    fill: false,
    data: [{ x: modifiedDmax, y: modifiedDmaxY }],
    pointRadius: 0
  });

  chart.update();

  // Add text annotations for the Lactate Threshold, DMAX, and DMAX MOD
  addTextAnnotation(lactateThreshold, 4, 'Lactate Threshold');
  addTextAnnotation(dmax, evaluatePolynomial(coefficients, dmax), 'DMAX');
  addTextAnnotation(modifiedDmax, modifiedDmaxY, 'DMAX MOD');
}

function addTextAnnotation(x, y, label) {
  chart.options.plugins.annotation = chart.options.plugins.annotation || { annotations: [] };

  chart.options.plugins.annotation.annotations.push({
    type: 'label',
    x: x,
    y: y,
    backgroundColor: 'white',
    font: { size: 12 },
    text: `${label} (Load: ${x.toFixed(2)}, Lactate: ${y.toFixed(2)})`,
    padding: 4,
    color: 'black',
    rotation: 0
  });

  chart.update();
}

// Calculate Lactate Threshold (Lactate = 4)
function calculateLactateThreshold(coefficients, lactateValue) {
  // Polynomial equation: y = ax^3 + bx^2 + cx + d
  // Solve for x when y = lactateValue
  let a = coefficients[0];
  let b = coefficients[1];
  let c = coefficients[2];
  let d = coefficients[3];

  let roots = findCubicRoots(a, b, c, d - lactateValue);
  
  // Find the positive root (the valid lactate threshold load)
  return roots.filter(root => root >= 0)[0];
}

// Finding the roots of the cubic equation
function findCubicRoots(a, b, c, d) {
  // Solving ax^3 + bx^2 + cx + d = 0
  let delta0 = b * b - 3 * a * c;
  let delta1 = 2 * b * b * b - 9 * a * b * c + 27 * a * a * d;
  let discriminant = delta1 * delta1 - 4 * delta0 * delta0 * delta0;

  let C = Math.cbrt((delta1 + Math.sqrt(discriminant)) / 2);

  let roots = [];
  for (let k = 0; k < 3; k++) {
    let root = -1 / (3 * a) * (b + Math.pow(-1, k) * C + delta0 / (Math.pow(-1, k) * C));
    roots.push(root);
  }
  return roots;
}

// Calculate DMAX (Maximum perpendicular distance from the curve to the line formed by the two endpoints)
function calculateDmax(coefficients, dataPoints) {
  let firstPoint = dataPoints[0];
  let lastPoint = dataPoints[dataPoints.length - 1];

  // The line formed by the two endpoints
  let slope = (lastPoint.y - firstPoint.y) / (lastPoint.x - firstPoint.x);
  let intercept = firstPoint.y - slope * firstPoint.x;

  // Calculate the perpendicular distance for each point in the polynomial curve
  let maxDistance = 0;
  let dmaxX = 0;

  for (let point of dataPoints) {
    let distance = Math.abs(slope * point.x - point.y + intercept) / Math.sqrt(slope * slope + 1);
    if (distance > maxDistance) {
      maxDistance = distance;
      dmaxX = point.x;
    }
  }

  return dmaxX;
}
