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
      datasets: [
        {
          label: 'Data Points',
          borderColor: 'black',
          backgroundColor: 'black',
          fill: false,
          showLine: false,
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
  dataPoints.sort((a, b) => a.x - b.x);

  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);
  chart.data.datasets[0].data = dataPoints;
  chart.data.datasets[1].data = polynomialCurve;
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  let lactateThreshold4 = findThreshold(coefficients, 4);
  let dmax = calculateDmax(dataPoints, polynomialCurve);
  let dmaxMod = calculateDmaxMod(dataPoints, polynomialCurve);

  displayThresholds(lactateThreshold4, dmax, dmaxMod);
  chart.update();
}

function findThreshold(coefficients, target) {
  let minX = 0, maxX = 100;
  for (let x = minX; x <= maxX; x += 0.1) {
    let y = evaluatePolynomial(coefficients, x);
    if (Math.abs(y - target) < 0.1) return x;
  }
  return NaN;
}

function calculateDmax(points, curve) {
  let first = points[0], last = points[points.length - 1];
  let maxDist = 0, bestX = NaN;
  for (let p of curve) {
    let d = perpendicularDistance(first, last, p);
    if (d > maxDist) {
      maxDist = d;
      bestX = p.x;
    }
  }
  return bestX;
}

function calculateDmaxMod(points, curve) {
  let index = points.findIndex((p, i) => i > 0 && p.y - points[i - 1].y > 0.4);
  let refPoint = index > 0 ? points[index - 1] : points[0];
  let last = points[points.length - 1];
  let maxDist = 0, bestX = NaN;
  for (let p of curve) {
    let d = perpendicularDistance(refPoint, last, p);
    if (d > maxDist) {
      maxDist = d;
      bestX = p.x;
    }
  }
  return bestX;
}

function displayThresholds(lt4, dmax, dmaxMod) {
  document.getElementById("threshold-results").innerHTML = `
    <p><strong>Lactate 4.0 mmol/L:</strong> ${lt4.toFixed(2)}</p>
    <p><strong>DMAX:</strong> ${dmax.toFixed(2)}</p>
    <p><strong>DMAX MOD:</strong> ${dmaxMod.toFixed(2)}</p>
  `;
}

function perpendicularDistance(p1, p2, p) {
  let num = Math.abs((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x);
  let den = Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
  return num / den;
}

function evaluatePolynomial(coefficients, x) {
  return coefficients.reduce((sum, c, i) => sum + c * Math.pow(x, coefficients.length - 1 - i), 0);
}
