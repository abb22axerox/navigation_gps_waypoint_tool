// gps-proxy.cjs
const net = require("net");
const WebSocket = require("ws");

const gpsIP = "192.168.1.1"; // Replace with your iPhone's hotspot IP
const gpsPort = 11123; // GPS2IP port
const wsPort = 3001; // WebSocket port for Vue app

// Connect to GPS2IP TCP
const gpsSocket = new net.Socket();
gpsSocket.connect(gpsPort, gpsIP, () => {
  console.log(`Connected to GPS2IP at ${gpsIP}:${gpsPort}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ port: wsPort }, () => {
  console.log(`WebSocket server running at ws://localhost:${wsPort}`);
});

// Broadcast GPS NMEA sentences to all WebSocket clients
gpsSocket.on("data", (data) => {
  const message = data.toString();
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

// Handle errors
gpsSocket.on("error", (err) => {
  console.error("TCP connection error:", err);
});
