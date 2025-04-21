import net from 'net'
import WebSocket, { WebSocketServer } from 'ws'

const WS_PORT = 3001

// Create WebSocket Server
const wss = new WebSocketServer({ port: WS_PORT }, () => {
  console.log(`🌐 WebSocket server running on ws://localhost:${WS_PORT}`)
})

function connectToGps2ip() {
  // Read settings from localStorage if available, otherwise use defaults
  const TCP_HOST = localStorage.getItem('gps2ipHost') || '192.168.50.140'
  const TCP_PORT = Number(localStorage.getItem('gps2ipPort')) || 11123

  const gpsClient = new net.Socket()
  
  gpsClient.connect(TCP_PORT, TCP_HOST, () => {
    console.log(`🛰️ Connected to GPS2IP at ${TCP_HOST}:${TCP_PORT}`)
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

  gpsClient.on('error', (error) => {
    console.error('GPS connection error:', error)
    setTimeout(connectToGps2ip, 5000) // Try to reconnect after 5 seconds
  })

  gpsClient.on('close', () => {
    console.log('❌ GPS connection closed')
    setTimeout(connectToGps2ip, 5000) // Try to reconnect after 5 seconds
  })

  return gpsClient
}

// Start initial connection
connectToGps2ip()
