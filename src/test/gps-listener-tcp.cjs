// gps-listener-tcp.cjs
const net = require('net');

const client = new net.Socket();

client.connect(11123, '192.168.1.107', () => {
  console.log('🛰️ Connected to GPS2IP');
});

client.on('data', (data) => {
  console.log('📍 GPS Data:', data.toString());
});

client.on('close', () => {
  console.log('❌ Connection closed');
});
