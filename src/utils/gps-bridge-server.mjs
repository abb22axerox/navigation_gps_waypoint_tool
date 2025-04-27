import net from 'net'
import WebSocket, { WebSocketServer } from 'ws'

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  gps2ipHost: '192.168.50.25',
  gps2ipPort: 11123,
  maxReconnectAttempts: 3,
  reconnectDelay: 5000
};

// Proper argument parsing
for (let i = 0; i < args.length; i += 2) {
  const arg = args[i];
  const value = args[i + 1];
  
  if (!value) continue;
  
  switch (arg) {
    case '--host':
      config.gps2ipHost = value;
      break;
    case '--port':
      config.gps2ipPort = parseInt(value);
      break;
  }
}

const WS_PORT = 3001
let reconnectAttempts = 0
let gpsClient = null

function connectToGps2ip() {
  if (gpsClient) {
    gpsClient.destroy();
    gpsClient = null;
  }
  console.log(`👉 Attempting GPS2IP connection to ${config.gps2ipHost}:${config.gps2ipPort}`)
  
  gpsClient = new net.Socket()
  
  gpsClient.on('connect', () => {
    console.log(`🛰️ Connected to GPS2IP at ${config.gps2ipHost}:${config.gps2ipPort}`)
    reconnectAttempts = 0
  })

  gpsClient.on('error', (error) => {
    console.error(`GPS connection error: ${error.code} (${error.address}:${error.port})`)
    reconnectAttempts++
    
    if (reconnectAttempts < config.maxReconnectAttempts) {
      console.log(`⌛ Reconnecting in ${config.reconnectDelay/1000}s... (${reconnectAttempts}/${config.maxReconnectAttempts})`)
      setTimeout(() => connectToGps2ip(), config.reconnectDelay)
    } else {
      console.log('❌ Max reconnection attempts reached. Exiting...')
      process.exit(1)
    }
  })

  gpsClient.on('close', () => {
    console.log('📡 GPS connection closed')
  })

  gpsClient.on('data', (data) => {
    const nmea = data.toString().trim()
    console.log('📡 Received:', nmea)

    // Broadcast to all WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(nmea)
      }
    })
  })

  // Actually try to connect
  try {
    gpsClient.connect(config.gps2ipPort, config.gps2ipHost)
  } catch (err) {
    console.error('Failed to initiate connection:', err)
  }
}

// Create WebSocket Server
const wss = new WebSocketServer({ port: WS_PORT }, () => {
  console.log(`🌐 WebSocket server running on ws://localhost:${WS_PORT}`)
  connectToGps2ip()
})

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...')
  if (gpsClient) gpsClient.destroy()
  wss.close()
  process.exit(0)
})
