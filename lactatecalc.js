let chart = null;

function toggleTool() {
  const toolContainer = document.getElementById('tool-container');
  const isHidden = (toolContainer.style.display === 'none' || toolContainer.style.display === '');
  
  toolContainer.style.display = isHidden ? 'flex' : 'none';

  if (isHidden && !chart) {
    initializeGraph();
  }

  if (isHidden && document.getElementById("data-table").getElementsByTagName('tbody')[0].children.length === 0) {
    addRow();
  }
}

function addRow() {
  const table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  const newRow = table.insertRow();
  const cell1 = newRow.insertCell(0);
  const cell2 = newRow.insertCell(1);
  
  cell1.innerHTML = '<input type="number" step="any" oninput="updateGraph()">'; 
  cell2.innerHTML = '<input type="number" step="any" oninput="updateGraph()">'; 
}

function initializeGraph() {
  const ctx = document.getElementById('lactateChart').getContext('2d');

  chart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Data Points',
          borderColor: 'transparent',
          backgroundColor: 'black',
          pointRadius: 5,
          data: []
        },
        {
          label: 'Polynomial Fit',
          borderColor: 'red',
          backgroundColor: 'transparent',
          fill: false,
          showLine: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          data: []
        }
      ]
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

function updateGraph() {
  if (!chart) return;

  const table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  const rows = table.getElementsByTagName('tr');

  const dataPoints = [];

  for (const row of rows) {
    const inputs = row.getElementsByTagName('input');
    const x = parseFloat(inputs[0].value);
    const y = parseFloat(inputs[1].value);

    if (!isNaN(x) && !isNaN(y)) {
      dataPoints.push({ x, y });
    }
  }

  if (dataPoints.length === 0) return;

  dataPoints.sort((a, b) => a.x - b.x);

  const coefficients = polynomialRegression(dataPoints, 3);
  const polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  const rSquared = calculateRSquared(dataPoints, polynomialCurve);

  chart.data.datasets[0].data = [...dataPoints];
  chart.data.datasets[1].data = [...polynomialCurve];

  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  chart.update();
}

function polynomialRegression(points, degree) {
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  
  const X = [];
  for (let i = 0; i < points.length; i++) {
    X[i] = [];
    for (let j = 0; j <= degree; j++) {
      X[i][j] = Math.pow(xValues[i], degree - j);
    }
  }

  const Xt = math.transpose(X);
  const XtX = math.multiply(Xt, X);
  const XtY = math.multiply(Xt, yValues);
  const coefficientsMatrix = math.lusolve(XtX, XtY);

  const coefficients = coefficientsMatrix.map(row => row[0]);

  return coefficients;
}

function generatePolynomialCurve(coefficients, points) {
  const xValues = points.map(p => p.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const step = (maxX - minX) / 100;
  const curve = [];

  for (let x = minX; x <= maxX; x += step) {
    let y = 0;
    for (let i = 0; i < coefficients.length; i++) {
      y += coefficients[i] * Math.pow(x, coefficients.length - 1 - i);
    }
    curve.push({ x, y });
  }

  return curve;
}

function calculateRSquared(points, polynomialCurve) {
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);

  const interpolatedY = points.map(p => {
    const closest = polynomialCurve.reduce((prev, curr) =>
      Math.abs(curr.x - p.x) < Math.abs(prev.x - p.x) ? curr : prev
    );
    return closest.y;
  });

  const ssResidual = points.reduce((sum, p, i) => sum + Math.pow(p.y - interpolatedY[i], 2), 0);

  return 1 - (ssResidual / ssTotal);
}

