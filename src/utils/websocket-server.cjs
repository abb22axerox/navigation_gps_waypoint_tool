const WebSocket = require("ws");

const server = new WebSocket.Server({ port: 9091 });

server.on("connection", (socket) => {
  console.log("📡 Client connected");

  socket.on("message", (message) => {
    console.log("📨 Received:", message);
    // Echo back the message
    socket.send(`Echo: ${message}`);
  });

  socket.on("close", () => {
    console.log("❌ Client disconnected");
  });
});
