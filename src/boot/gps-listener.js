import { boot } from 'quasar/wrappers'
import { EventEmitter } from 'events'

class GpsListener extends EventEmitter {
  constructor() {
    super()
    this.socket = null
    this.latest = null
    this.setMaxListeners(20)
    this.lastUpdate = Date.now()
    this.checkInterval = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3
  }

  start() {
    if (this.socket?.readyState === WebSocket.OPEN) return
    
    try {
      this.socket = new WebSocket('ws://localhost:3001')

      this.socket.onopen = () => {
        console.log('🌐 Connected to GPS bridge');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startDataCheck();
        this.emit('connected'); // <-- new event emitted on successful connection
      }

      this.socket.onmessage = (event) => {
        const nmeaData = event.data.trim()
        this.lastUpdate = Date.now()
        
        const parts = nmeaData.split(',')
        if (parts[0].includes('$GPRMC') && parts[2] === 'A') {
          // Parse latitude - Format is DDMM.MMMM
          const rawLat = parseFloat(parts[3])
          const latDeg = Math.floor(rawLat / 100) // Extract degrees
          const latMin = (rawLat % 100) / 60 // Convert minutes to decimal degrees
          let latitude = latDeg + latMin
          if (parts[4] === 'S') latitude = -latitude

          // Parse longitude - Format is DDDMM.MMMM
          const rawLon = parseFloat(parts[5])
          const lonDeg = Math.floor(rawLon / 100) // Extract degrees
          const lonMin = (rawLon % 100) / 60 // Convert minutes to decimal degrees
          let longitude = lonDeg + lonMin
          if (parts[6] === 'W') longitude = -longitude

          // For Leaflet, store as [latitude, longitude]
          this.latest = [latitude, longitude]
          this.emit('location', this.latest)
        }
      }

      this.socket.onerror = () => {
        if (this.isConnected) {
          console.log('❌ GPS WebSocket error')
          this.stopDataCheck()
        }
      }

      this.socket.onclose = () => {
        if (this.isConnected) {
          console.log('❌ GPS WebSocket closed')
          this.isConnected = false
          this.stopDataCheck()
          this.tryReconnect()
        }
      }
    } catch (error) {
      console.log('Failed to initialize WebSocket')
    }
  }

  startDataCheck() {
    if (this.checkInterval) return
    
    this.checkInterval = setInterval(() => {
      if (!this.isConnected) return
      
      const timeSinceLastUpdate = Date.now() - this.lastUpdate
      if (timeSinceLastUpdate > 5000) {
        this.emit('error', new Error('GPS data stream stopped'))
        this.stop()
      }
    }, 1000)
  }

  stopDataCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached')
      return
    }
    
    this.reconnectAttempts++
    setTimeout(() => this.start(), 5000)
  }

  stop() {
    this.stopDataCheck()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.isConnected = false
  }
}

export const gpsListener = new GpsListener()

export default boot(({ app }) => {
  gpsListener.start()
  // Inject so components can use: this.$gpsListener
  app.config.globalProperties.$gpsListener = gpsListener
})
