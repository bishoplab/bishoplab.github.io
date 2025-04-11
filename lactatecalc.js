let chart = null;

function toggleTool() {
  let toolContainer = document.getElementById('tool-container');
  let isHidden = (toolContainer.style.display === 'none' || toolContainer.style.display === '');
  
  toolContainer.style.display = isHidden ? 'flex' : 'none';

  if (isHidden && !chart) {
    initializeGraph();
  }

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

  let { dmax, dmaxPoint } = calculateDmax(dataPoints, polynomialCurve);
  let { dmaxMod, dmaxModPoint } = calculateDmaxMod(dataPoints, polynomialCurve);

  chart.data.datasets = chart.data.datasets.slice(0, 2); // Reset to only data points and curve
  chart.data.datasets[0].data = [...dataPoints];
  chart.data.datasets[1].data = [...polynomialCurve];

  if (dmaxPoint) {
    chart.data.datasets.push({
      label: 'DMAX Point',
      backgroundColor: 'blue',
      pointRadius: 6,
      data: [dmaxPoint]
    });
  }

  if (dmaxModPoint) {
    chart.data.datasets.push({
      label: 'DMAX MOD Point',
      backgroundColor: 'green',
      pointRadius: 6,
      data: [dmaxModPoint]
    });
  }

  chart.options.plugins.title.text = 
    `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)} | DMAX: ${dmaxPoint?.x.toFixed(2) ?? 'N/A'} | DMAX MOD: ${dmaxModPoint?.x.toFixed(2) ?? 'N/A'})`;

  chart.update();

  console.log(`DMAX: ${dmax.toFixed(4)} at Load ${dmaxPoint?.x.toFixed(2)}, Lactate ${dmaxPoint?.y.toFixed(2)}`);
  if (dmaxModPoint) {
    console.log(`DMAX MOD: ${dmaxMod.toFixed(4)} at Load ${dmaxModPoint.x.toFixed(2)}, Lactate ${dmaxModPoint.y.toFixed(2)}`);
  } else {
    console.log('DMAX MOD: Not found (no sufficient lactate rise > 0.4 mmol/L)');
  }
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

function generatePolynomialCurve(coefficients, points) {
  return points.map(point => {
    let y = 0;
    for (let i = 0; i < coefficients.length; i++) {
      y += coefficients[i][0] * Math.pow(point.x, coefficients.length - 1 - i);
    }
    return { x: point.x, y: y };
  });
}

function calculateRSquared(points, polynomialCurve) {
  let meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  let ssResidual = points.reduce((sum, p, i) => sum + Math.pow(p.y - polynomialCurve[i].y, 2), 0);
  return 1 - (ssResidual / ssTotal);
}

function pointToLineDistance(point, lineStart, lineEnd) {
  let x0 = point.x, y0 = point.y;
  let x1 = lineStart.x, y1 = lineStart.y;
  let x2 = lineEnd.x, y2 = lineEnd.y;

  let numerator = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2*y1 - y2*x1);
  let denominator = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

  return numerator / denominator;
}

function calculateDmax(dataPoints, polynomialCurve) {
  const lineStart = polynomialCurve[0];
  const lineEnd = polynomialCurve[polynomialCurve.length - 1];

  let maxDist = -Infinity;
  let dmaxPoint = null;

  for (let point of polynomialCurve) {
    let dist = pointToLineDistance(point, lineStart, lineEnd);
    if (dist > maxDist) {
      maxDist = dist;
      dmaxPoint = point;
    }
  }

  return { dmax: maxDist, dmaxPoint };
}

function calculateDmaxMod(dataPoints, polynomialCurve) {
  if (dataPoints.length < 3) return { dmaxMod: null, dmaxModPoint: null };

  let idx = -1;
  for (let i = 1; i < dataPoints.length; i++) {
    if ((dataPoints[i].y - dataPoints[i - 1].y) > 0.4) {
      idx = i - 1;
      break;
    }
  }

  if (idx === -1) return { dmaxMod: null, dmaxModPoint: null };

  const lineStart = polynomialCurve.find(p => p.x === dataPoints[idx].x);
  const lineEnd = polynomialCurve[polynomialCurve.length - 1];

  if (!lineStart || !lineEnd) return { dmaxMod: null, dmaxModPoint: null };

  let maxDist = -Infinity;
  let dmaxModPoint = null;

  for (let point of polynomialCurve) {
    if (point.x > lineStart.x) {
      let dist = pointToLineDistance(point, lineStart, lineEnd);
      if (dist > maxDist) {
        maxDist = dist;
        dmaxModPoint = point;
      }
    }
  }

  return { dmaxMod: maxDist, dmaxModPoint };
}
