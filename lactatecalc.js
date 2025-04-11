let chart = null;

function toggleTool() {
  const toolContainer = document.getElementById('tool-container');
  const isHidden = (toolContainer.style.display === 'none' || toolContainer.style.display === '');

  toolContainer.style.display = isHidden ? 'flex' : 'none';

  if (isHidden) {
    if (!chart) initializeGraph();

    const tableBody = document.getElementById("data-table").getElementsByTagName('tbody')[0];
    if (tableBody.children.length === 0) addRow();
  }
}

function addRow() {
  const table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  const newRow = table.insertRow();

  newRow.insertCell(0).innerHTML = '<input type="number" step="any" oninput="updateGraph()">';
  newRow.insertCell(1).innerHTML = '<input type="number" step="any" oninput="updateGraph()">';
}

function initializeGraph() {
  const ctx = document.getElementById('lactateChart').getContext('2d');

  chart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Data Points',
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
        tooltip: { enabled: true },
        title: {
          display: true,
          text: 'Lactate Threshold Curve (R²: )',
          font: { size: 16 }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Load' },
          min: 0
        },
        y: {
          title: { display: true, text: 'Lactate Concentration' },
          min: 0
        }
      }
    }
  });
}

function updateGraph() {
  if (!chart) return;

  const table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  const rows = table.getElementsByTagName('tr');

  const dataPoints = Array.from(rows).map(row => {
    const [xInput, yInput] = row.getElementsByTagName('input');
    const x = parseFloat(xInput.value);
    const y = parseFloat(yInput.value);
    return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
  }).filter(Boolean);

  if (dataPoints.length === 0) return;

  dataPoints.sort((a, b) => a.x - b.x);

  const coefficients = polynomialRegression(dataPoints, 3);
  const polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);
  const rSquared = calculateRSquared(dataPoints, polynomialCurve);

  const { dmax, dmaxPoint } = calculateDmax(dataPoints, polynomialCurve);
  const { dmaxMod, dmaxModPoint } = calculateDmaxMod(dataPoints, polynomialCurve);

  chart.data.datasets = [
    {
      ...chart.data.datasets[0],
      data: [...dataPoints]
    },
    {
      ...chart.data.datasets[1],
      data: [...polynomialCurve]
    }
  ];

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

  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)} | DMAX: ${dmaxPoint?.x.toFixed(1)} / ${dmaxPoint?.y.toFixed(1)} | DMAX MOD: ${dmaxModPoint?.x.toFixed(1)} / ${dmaxModPoint?.y.toFixed(1)})`;

  chart.update();

  console.log(`DMAX: ${dmax.toFixed(1)} at Load ${dmaxPoint?.x.toFixed(1)}, Lactate ${dmaxPoint?.y.toFixed(1)}`);
  if (dmaxModPoint) {
    console.log(`DMAX MOD: ${dmaxMod.toFixed(1)} at Load ${dmaxModPoint.x.toFixed(1)}, Lactate ${dmaxModPoint.y.toFixed(1)}`);
  } else {
    console.log('DMAX MOD: Not found (no sufficient lactate rise > 0.4 mmol/L)');
  }
}

function polynomialRegression(points, degree) {
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);

  const X = points.map(p => Array.from({ length: degree + 1 }, (_, j) => Math.pow(p.x, degree - j)));

  const Xt = math.transpose(X);
  const XtX = math.multiply(Xt, X);
  const XtY = math.multiply(Xt, yValues);
  const coefficients = math.lusolve(XtX, XtY);

  return coefficients;
}

function generatePolynomialCurve(coefficients, points) {
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const step = (maxX - minX) / 1000;

  return Array.from({ length: 1001 }, (_, i) => {
    const x = minX + step * i;
    const y = coefficients.reduce((acc, coef, j) => acc + coef[0] * Math.pow(x, coefficients.length - 1 - j), 0);
    return { x, y };
  });
}

function calculateRSquared(points, curve) {
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = points.reduce((sum, p, i) => sum + Math.pow(p.y - curve[i].y, 2), 0);
  return 1 - (ssResidual / ssTotal);
}

function pointToLineDistance(point, start, end) {
  const { x: x0, y: y0 } = point;
  const { x: x1, y: y1 } = start;
  const { x: x2, y: y2 } = end;

  const numerator = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
  const denominator = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

  return numerator / denominator;
}

function calculateDmax(points, curve) {
  const [start, end] = [curve[0], curve[curve.length - 1]];
  let maxDist = -Infinity;
  let dmaxPoint = null;

  for (const point of curve) {
    const dist = pointToLineDistance(point, start, end);
    if (dist > maxDist) {
      maxDist = dist;
      dmaxPoint = point;
    }
  }

  return { dmax: maxDist, dmaxPoint };
}

function calculateDmaxMod(points, curve) {
  if (points.length < 3) return { dmaxMod: null, dmaxModPoint: null };

  const idx = points.findIndex((p, i) => i > 0 && (p.y - points[i - 1].y) > 0.4) - 1;
  if (idx < 0) return { dmaxMod: null, dmaxModPoint: null };

  const lineStart = curve.find(p => p.x >= points[idx].x);
  const lineEnd = curve[curve.length - 1];
  if (!lineStart || !lineEnd) return { dmaxMod: null, dmaxModPoint: null };

  let maxDist = -Infinity;
  let dmaxModPoint = null;

  for (const point of curve) {
    if (point.x > lineStart.x) {
      const dist = pointToLineDistance(point, lineStart, lineEnd);
      if (dist > maxDist) {
        maxDist = dist;
        dmaxModPoint = point;
      }
    }
  }

  return { dmaxMod: maxDist, dmaxModPoint };
}
