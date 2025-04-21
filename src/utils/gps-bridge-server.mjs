import net from 'net'
import WebSocket, { WebSocketServer } from 'ws'

const TCP_HOST = '192.168.1.107'
const TCP_PORT = 11123
const WS_PORT = 3001

// Create WebSocket Server
const wss = new WebSocketServer({ port: WS_PORT }, () => {
  console.log(`🌐 WebSocket server running on ws://localhost:${WS_PORT}`)
})

// Connect to GPS2IP TCP socket
const gpsClient = new net.Socket()
gpsClient.connect(TCP_PORT, TCP_HOST, () => {
  console.log('🛰️ Connected to GPS2IP socket')
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

gpsClient.on('error', console.error)
gpsClient.on('close', () => console.log('❌ GPS connection closed'))
