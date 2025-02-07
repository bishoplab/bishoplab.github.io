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

  // Collect data from the table
  for (let row of rows) {
    let inputs = row.getElementsByTagName('input');
    let x = parseFloat(inputs[0].value);
    let y = parseFloat(inputs[1].value);

    if (!isNaN(x) && !isNaN(y)) {
      dataPoints.push({ x, y });
    } else {
      console.warn(`Invalid data at row ${dataPoints.length + 1}, x: ${x}, y: ${y}`);
    }
  }

  console.log("Data Points:", dataPoints); // Debugging output

  if (dataPoints.length === 0) {
    console.log("No valid data points entered.");
    return;
  }

  // Sort data by x-value for polynomial fitting
  dataPoints.sort((a, b) => a.x - b.x);

  // Polynomial regression (3rd-order) to fit a curve
  let coefficients = polynomialRegression(dataPoints, 3);
  let polynomialCurve = generatePolynomialCurve(coefficients, dataPoints);

  // Calculate R² value
  let rSquared = calculateRSquared(dataPoints, polynomialCurve);

  // Find the peak lactate point (the maximum y value from the polynomial curve)
  let peakLactatePoint = polynomialCurve.reduce((maxPoint, currentPoint) => {
    return currentPoint.y > maxPoint.y ? currentPoint : maxPoint;
  }, polynomialCurve[0]);

  // Find the first lactate point above 0.4 mmol/L over resting level
  let restingLevel = dataPoints[0].y; // Assuming resting level is the first point
  let threshold = restingLevel + 0.4;
  let thresholdPoint = dataPoints.find(p => p.y >= threshold);

  if (!thresholdPoint) {
    console.error('No lactate point found above 0.4 mmol/L over resting level.');
    return;
  }

  // Create a line from peak lactate point to the threshold point
  let lineStart = peakLactatePoint;
  let lineEnd = thresholdPoint;

  // Calculate the perpendicular distances from the polynomial curve to the line
  let { maxDistance, maxPoint } = findMaxPerpendicularDistance(polynomialCurve, lineStart, lineEnd);

  // Now you have the Dmax point, maxPoint, and the corresponding maximum distance
  console.log("Dmax Point:", maxPoint);
  console.log("Maximum Perpendicular Distance:", maxDistance);

  // Display Dmax on the graph (optional)
  document.getElementById("dmax-display").innerText = `Dmax Point: x = ${maxPoint.x.toFixed(2)}, y = ${maxPoint.y.toFixed(2)}`;

  // Update chart with data points and polynomial curve
  chart.data.datasets[0].data = [...dataPoints]; // Ensure black dots appear
  chart.data.datasets[1].data = [...polynomialCurve]; // Red polynomial line (smooth)

  // Update the title with the R² value
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Highlight the Dmax point on the graph
  let dmaxDataset = chart.data.datasets.find(dataset => dataset.label === 'Dmax Point');
  if (dmaxDataset) {
    dmaxDataset.data = [{ x: maxPoint.x, y: maxPoint.y }];
  } else {
    chart.data.datasets.push({
      label: 'Dmax Point',
      borderColor: 'blue',
      backgroundColor: 'blue',
      pointRadius: 5,
      data: [{ x: maxPoint.x, y: maxPoint.y }]
    });
  }

  chart.update();
}

// Function to find the maximum perpendicular distance from the polynomial curve to the line
function findMaxPerpendicularDistance(polyCurve, lineStart, lineEnd) {
  // Calculate the slope (m) and intercept (b) of the line from start to end
  let m = (lineEnd.y - lineStart.y) / (lineEnd.x - lineStart.x); // Slope
  let b = lineStart.y - m * lineStart.x; // Y-intercept

  let maxDistance = -Infinity;
  let maxPoint = null;

  for (let point of polyCurve) {
    // Calculate perpendicular distance from point to line
    let distance = Math.abs(m * point.x - point.y + b) / Math.sqrt(m * m + 1);

    // Update if we find a greater distance
    if (distance > maxDistance) {
      maxDistance = distance;
      maxPoint = point;
    }
  }

  // Return the point with the maximum perpendicular distance
  return { maxDistance, maxPoint };
}

// Polynomial regression (3rd order)
function polynomialRegression(dataPoints, degree) {
  let xValues = dataPoints.map(p => p.x);
  let yValues = dataPoints.map(p => p.y);
  
  let X = [];
  let Y = yValues;

  for (let i = 0; i <= degree; i++) {
    X.push(xValues.map(x => Math.pow(x, i)));
  }

  let XT = math.transpose(X);
  let XTX = math.multiply(XT, X);
  let XTX_inv = math.inv(XTX);
  let XTY = math.multiply(XT, Y);

  let coefficients = math.multiply(XTX_inv, XTY);
  return coefficients;
}

// Generate the polynomial curve based on coefficients
function generatePolynomialCurve(coefficients, dataPoints) {
  return dataPoints.map(point => {
    let y = coefficients.reduce((sum, coeff, idx) => sum + coeff * Math.pow(point.x, idx), 0);
    return { x: point.x, y: y };
  });
}

// Calculate R² value
function calculateRSquared(actualData, fittedCurve) {
  let ssTot = 0;
  let ssRes = 0;
  let yMean = actualData.reduce((sum, point) => sum + point.y, 0) / actualData.length;

  for (let i = 0; i < actualData.length; i++) {
    ssTot += Math.pow(actualData[i].y - yMean, 2);
    ssRes += Math.pow(actualData[i].y - fittedCurve[i].y, 2);
  }

  return 1 - (ssRes / ssTot);
}
