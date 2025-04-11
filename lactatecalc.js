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
      datasets: [{
        label: 'Data Points',
        data: [],
        backgroundColor: 'black',
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
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
    },
    plugins: [ChartRegressions] // Register the regression plugin
  });
}

function updateGraph() {
  if (!chart) return;

  const table = document.getElementById("data-table").getElementsByTagName('tbody')[0];
  const rows = table.getElementsByTagName('tr');

  const dataPoints = [];

  // Loop through each row in the table and extract data
  for (let row of rows) {
    const inputs = row.getElementsByTagName('input');
    const x = parseFloat(inputs[0].value);
    const y = parseFloat(inputs[1].value);

    if (!isNaN(x) && !isNaN(y)) {
      dataPoints.push({ x, y });
    }
  }

  // If no data points, exit
  if (dataPoints.length === 0) return;

  // Sort the data points by x (Load) for proper regression calculation
  dataPoints.sort((a, b) => a.x - b.x);

  // Update the chart with new data points
  chart.data.datasets[0].data = dataPoints;

  // Update the regression line and title (ChartRegressions plugin will handle the regression)
  chart.data.datasets[0].regression = {
    type: 'polynomial',
    order: 3,
    line: {
      color: 'red',
      width: 2
    }
  };

  // Update chart title with R² value (calculated by the regression plugin)
  const regressionResult = chart.data.datasets[0].regressionResult;
  const rSquared = regressionResult ? regressionResult.r2 : 0;
  chart.options.plugins.title.text = `Lactate Threshold Curve (R²: ${rSquared.toFixed(4)})`;

  // Redraw the chart with updated data
  chart.update();
}
