import net from 'net';
import { WebSocketServer } from 'ws';

const TCP_PORT = 5555;
const WS_PORT = 8080;

const wss = new WebSocketServer({ port: WS_PORT });
let clients = [];

wss.on('connection', ws => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// TCP server
const tcpServer = net.createServer(socket => {
  let buffer = '';
  socket.on('data', chunk => {
    // console.log('Raw TCP data:', chunk.toString());
    buffer += chunk.toString();

    // Try to parse complete JSON objects (assuming each message ends with '\n')
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      const jsonStr = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);

      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);
          const gps = {
            device_id: data.deviceID,
            time: data.locationTimestamp_since1970,
            lat: data.locationLatitude,
            lon: data.locationLongitude,
            speed: data.locationSpeed,
            course: data.locationCourse,
            trueHeading: data.locationTrueHeading,
            altitude: data.locationAltitude,
            battery_level: data.batteryLevel,
          };
          console.log('Parsed GPS data:', gps);
          clients.forEach(c => c.send(JSON.stringify(gps)));
        } catch (err) {
          console.error('Invalid message:', err.message);
        }
      }
    }
  });
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`Listening for TCP data on port ${TCP_PORT}`);
  console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
});
