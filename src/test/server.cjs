const express = require('express');
const cors = require('cors'); // add cors module
const app = express();

app.use(cors()); // enable CORS for all endpoints
app.use(express.json());

// POST endpoint to receive GPS data and store it
app.post('/gps', (req, res) => {
  console.log('🧾 Received GPS data:', req.body);
  latestGPSCoordinate = req.body; // assuming the POST body contains the coordinate
  res.sendStatus(200);
});

// GET endpoint to return the latest GPS coordinate
app.get('/gps', (req, res) => {
  if (latestGPSCoordinate) {
    // Return an array [longitude, latitude]
    res.json([
      parseFloat(latestGPSCoordinate.longitude),
      parseFloat(latestGPSCoordinate.latitude)
    ]);
  } else {
    res.status(404).json({ error: 'No GPS coordinate received yet' });
  }
});

app.listen(3000, () => {
  console.log('🌐 GPS server listening on http://localhost:3000/gps');
});
