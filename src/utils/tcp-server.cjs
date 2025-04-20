// tcp-server.js
const net = require("net");
const PORT = 11123; // The port number you specified in GPS2IP
const HOST = "0.0.0.0"; // Listen on all available network interfaces

const server = net.createServer((socket) => {
  console.log("✅ GPS2IP connected");

  socket.on("data", (data) => {
    console.log("📍 Received GPS Data:", data.toString());
  });

  socket.on("end", () => {
    console.log("❌ GPS2IP disconnected");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
});
