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
      responsive: false, // Disable responsive resizing
      maintainAspectRatio: true, // Keep the aspect ratio fixed
      aspectRatio: 2, // Set a custom aspect ratio (height/width)
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { 
          title: { 
            display: true, 
            text: 'Load', 
            font: { size: 16 }, 
            padding: { top: 20 } // Add space between x-axis title and graph
          }, 
          min: 0,
          ticks: { 
            font: { size: 14 },
            padding: 10 // Adjust spacing for x-axis ticks
          }
        },
        y: { 
          title: { 
            display: true, 
            text: 'Lactate Concentration', 
            font: { size: 16 }, 
            padding: { bottom: 20 } // Add space between y-axis title and graph
          },
          min: 0,
          ticks: { 
            font: { size: 14 },
            padding: 10 // Adjust spacing for y-axis ticks
          }
        }
      }
    }
  });

  // Ensure the table starts with one row
  addRow();
}
