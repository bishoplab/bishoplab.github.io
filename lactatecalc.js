let chart = null; // Define chart variable globally

// Function to initialize and update the graph
function updateGraph() {
  if (!chart) return;

  let table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  let rows = table.getElementsByTagName('tr');

  let dataPoints = [];

  // Get data points from the table
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

  // Polynomial regression (3rd-order) to fit a cubic curve
  let coefficients = polynomialRegression(dataPoints, 3); // Degree 3 for a cubic curve
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  // Calculate DMAX
  let DMAX = calculateDMAX(dataPoints, polynomialCurve);

  // Calculate DMAX MOD
  let DMAX_MOD = calculateDMAXMOD(dataPoints, polynomialCurve);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Update chart with data points and polynomial curve
  chart.data.datasets[0].data = [...dataPoints]; // Ensure black dots appear
  chart.data.datasets[1].data = [...polynomialCurve]; // Red polynomial line (best fit)

  // Update the title with the R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Display DMAX and DMAX MOD below the graph
  document.getElementById("DMAX").innerText = `DMAX: ${DMAX.toFixed(4)} mmol·L⁻¹`;
  document.getElementById("DMAX_MOD").innerText = `DMAX MOD: ${DMAX_MOD.toFixed(4)} mmol·L⁻¹`;

  chart.update();
}

// Calculate DMAX: The point with the maximal perpendicular distance from the line formed by the end points
function calculateDMAX(dataPoints, polynomialCurve) {
  let firstPoint = dataPoints[0];
  let lastPoint = dataPoints[dataPoints.length - 1];

  // Equation of the line formed by the first and last points
  let slope = (lastPoint.y - firstPoint.y) / (lastPoint.x - firstPoint.x); // Slope of the line
  let intercept = firstPoint.y - slope * firstPoint.x; // Y-intercept of the line

  // Calculate the perpendicular distance from each point to the line
  let maxDistance = 0;
  let DMAXPoint = null;
  polynomialCurve.forEach(point => {
    let distance = Math.abs(slope * point.x - point.y + intercept) / Math.sqrt(slope * slope + 1);
    if (distance > maxDistance) {
      maxDistance = distance;
      DMAXPoint = point;
    }
  });

  return maxDistance;
}

// Calculate DMAX MOD: The point with the maximal perpendicular distance from the line formed by the point after a lactate increase > 0.4 mmol·L⁻¹ and the last point
function calculateDMAXMOD(dataPoints, polynomialCurve) {
  let lactateIncreaseThreshold = 0.4;
  let thresholdPoint = null;

  // Find the point where lactate concentration increases by more than 0.4 mmol·L⁻¹
  for (let i = 1; i < dataPoints.length; i++) {
    let prevPoint = dataPoints[i - 1];
    let currPoint = dataPoints[i];
    if (currPoint.y - prevPoint.y > lactateIncreaseThreshold) {
      thresholdPoint = currPoint;
      break;
    }
  }

  if (!thresholdPoint) return 0; // No threshold point found

  let lastPoint = dataPoints[dataPoints.length - 1];

  // Equation of the line formed by the threshold point and last point
  let slope = (lastPoint.y - thresholdPoint.y) / (lastPoint.x - thresholdPoint.x);
  let intercept = thresholdPoint.y - slope * thresholdPoint.x;

  // Calculate the perpendicular distance from each point to the line
  let maxDistance = 0;
  let DMAXMODPoint = null;
  polynomialCurve.forEach(point => {
    let distance = Math.abs(slope * point.x - point.y + intercept) / Math.sqrt(slope * slope + 1);
    if (distance > maxDistance) {
      maxDistance = distance;
      DMAXMODPoint = point;
    }
  });

  return maxDistance;
}

// The following functions are for polynomial regression, generating the curve, and calculating R²
function polynomialRegression(dataPoints, degree) {
  let X = [];
  let Y = [];
  dataPoints.forEach((point) => {
    X.push([1, point.x, point.x * point.x, point.x * point.x * point.x]);
    Y.push([point.y]);
  });

  let Xt = numeric.transpose(X);
  let XtX = numeric.dotMMbig(Xt, X);
  let XtY = numeric.dotMMbig(Xt, Y);
  let coefficients = numeric.solve(XtX, XtY);

  return coefficients;
}

function generatePolynomialCurve(coefficients, dataPoints) {
  return dataPoints.map((point) => {
    let y = coefficients[0] + coefficients[1] * point.x + coefficients[2] * point.x * point.x + coefficients[3] * point.x * point.x * point.x;
    return { x: point.x, y: y };
  });
}

function calculateRSquared(dataPoints, polynomialCurve) {
  let meanY = dataPoints.reduce((sum, point) => sum + point.y, 0) / dataPoints.length;
  let ssTotal = dataPoints.reduce((sum, point) => sum + Math.pow(point.y - meanY, 2), 0);
  let ssResidual = dataPoints.reduce((sum, point, i) => sum + Math.pow(point.y - polynomialCurve[i].y, 2), 0);
  return 1 - (ssResidual / ssTotal);
}

// Initialize the chart on page load
window.onload = function () {
  let ctx = document.getElementById('graph').getContext('2d');
  
  chart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Data Points',
          data: [],
          backgroundColor: 'black',
          borderColor: 'black',
          pointRadius: 5,
          showLine: false,
        },
        {
          label: 'Polynomial Fit',
          data: [],
          backgroundColor: 'red',
          borderColor: 'red',
          pointRadius: 0,
          fill: false,
          lineTension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Lactate Threshold Curve (R²: 0.0000)', // Initial placeholder
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
        },
        y: {
          beginAtZero: true,
        },
      },
    },
  });
};

