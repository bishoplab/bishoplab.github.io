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
        borderColor: 'transparent',
        backgroundColor: 'black',
        pointRadius: 5,
        data: []
      }, {
        label: 'Polynomial Fit',
        borderColor: 'red',
        backgroundColor: 'transparent',
        fill: false,
        showLine: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        data: []
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
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

  if (dataPoints.length === 0) return;

  dataPoints.sort((a, b) => a.x - b.x);

  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  chart.data.datasets[0].data = [...dataPoints];
  chart.data.datasets[1].data = [...polynomialCurve];

  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  chart.update();

  const dmax = calculateDmax(dataPoints, polynomialCurve);
  const dmaxMod = calculateDmaxMod(dataPoints, polynomialCurve);

  console.log("DMAX:", dmax);
  console.log("DMAX MOD:", dmaxMod);
}

function polynomialRegression(points, degree) {
  let xValues = points.map(p => p.x);
  let yValues = points.map(p => p.y);

  let X = [];
  for (let i = 0; i < points.length; i++) {
    X[i] = [];
    for (let j = 0; j <= degree; j++) {
      X[i][j] = Math.pow(xValues[i], degree - j);
    }
  }

  let Xt = math.transpose(X);
  let XtX = math.multiply(Xt, X);
  let XtY = math.multiply(Xt, yValues);
  let coefficients = math.lusolve(XtX, XtY);

  return coefficients;
}

function generatePolynomialCurve(coefficients, dataPoints) {
  const minX = Math.min(...dataPoints.map(p => p.x));
  const maxX = Math.max(...dataPoints.map(p => p.x));
  const curve = [];

  for (let i = 0; i <= 1000; i++) {
    const x = minX + i * (maxX - minX) / 1000;
    let y = 0;
    for (let j = 0; j < coefficients.length; j++) {
      y += coefficients[j][0] * Math.pow(x, coefficients.length - 1 - j);
    }
    curve.push({ x, y });
  }

  return curve;
}

function calculateRSquared(points, polynomialCurve) {
  let meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  let ssResidual = points.reduce((sum, p, i) => sum + Math.pow(p.y - polynomialCurve[i].y, 2), 0);
  return 1 - (ssResidual / ssTotal);
}

function calculateDmax(dataPoints, curve) {
  const start = dataPoints[0];
  const end = dataPoints[dataPoints.length - 1];

  let maxDistance = -Infinity;
  let dmaxX = null;

  for (let point of curve) {
    let d = perpendicularDistance(point, start, end);
    if (d > maxDistance) {
      maxDistance = d;
      dmaxX = point.x;
    }
  }

  return dmaxX;
}

function calculateDmaxMod(dataPoints, curve) {
  const threshold = 0.4;
  let startIndex = -1;

  for (let i = 1; i < dataPoints.length; i++) {
    if (dataPoints[i].y - dataPoints[i - 1].y > threshold) {
      startIndex = i - 1;
      break;
    }
  }

  if (startIndex === -1) return null;

  const start = dataPoints[startIndex];
  const end = dataPoints[dataPoints.length - 1];

  let maxDistance = -Infinity;
  let dmaxModX = null;

  for (let point of curve) {
    let d = perpendicularDistance(point, start, end);
    if (d > maxDistance) {
      maxDistance = d;
      dmaxModX = point.x;
    }
  }

  return dmaxModX;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const x0 = point.x, y0 = point.y;
  const x1 = lineStart.x, y1 = lineStart.y;
  const x2 = lineEnd.x, y2 = lineEnd.y;

  const numerator = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2*y1 - y2*x1);
  const denominator = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

  return numerator / denominator;
}
