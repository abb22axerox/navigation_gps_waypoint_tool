const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', ws => {
  console.log('📲 Client connected');

  ws.on('message', message => {
    try {
      // const data = JSON.parse(message);
      console.log('📍 GPS Received:', message);
    } catch (e) {
      console.error('❌ Error parsing message', e);
    }
  });

  ws.on('close', () => console.log('🔌 Client disconnected'));
});

console.log('🌐 WebSocket server running on ws://localhost:8080');
