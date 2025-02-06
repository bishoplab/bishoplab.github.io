let chart = null;

function toggleTool() {
  let toolContainer = document.getElementById('tool-container');
  let isHidden = (toolContainer.style.display === 'none' || toolContainer.style.display === '');
  
  toolContainer.style.display = isHidden ? 'flex' : 'none';

  // Initialize the graph when the tool is shown for the first time
  if (isHidden && !chart) {
    initializeGraph();
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
        borderColor: 'black',
        backgroundColor: 'black',
        showLine: true,
        fill: false,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 5,
        pointBackgroundColor: 'black',
        data: [] // Start empty, but the axes still show 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // Allow the chart to be flexible
      aspectRatio: 2, // Set a custom aspect ratio (height/width)
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Load', font: { size: 16 } }, 
          min: 0,
          ticks: { font: { size: 14 } } // Adjust font size for x-axis ticks
        },
        y: { 
          title: { display: true, text: 'Lactate Concentration', font: { size: 16 } },
          min: 0,
          ticks: { font: { size: 14 } } // Adjust font size for y-axis ticks
        }
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
  chart.data.datasets[0].data = dataPoints;
  chart.update();
}
