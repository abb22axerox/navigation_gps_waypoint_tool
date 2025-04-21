import { boot } from 'quasar/wrappers'
import { EventEmitter } from 'events'

class GpsListener extends EventEmitter {
  constructor() {
    super()
    this.socket = null
    this.latest = null  // will store the latest coordinates
    // Optionally increase max listeners to avoid warnings:
    this.setMaxListeners(20)
    this.lastUpdate = Date.now()
    this.checkInterval = null
  }

  start() {
    this.socket = new WebSocket('ws://localhost:3001')

    this.socket.onmessage = (event) => {
      const nmeaData = event.data.trim()
      console.log('📍 GPS Data from WebSocket:', nmeaData)
      this.lastUpdate = Date.now() // Update timestamp on each message

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

    // Start checking for stale data
    this.checkInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - this.lastUpdate
      if (timeSinceLastUpdate > 5000) { // 5 seconds threshold
        this.emit('error', new Error('GPS data stream stopped'))
      }
    }, 1000)

    this.socket.onerror = (error) => {
      console.error('GPS WebSocket error:', error)
      this.emit('error', error)
    }

    this.socket.onclose = () => {
      console.log('❌ GPS WebSocket closed')
      this.emit('close')
      // Optionally try to restart after a delay:
      setTimeout(() => this.start(), 5000)
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    if (this.socket) {
      this.socket.close()
    }
  }
}

export const gpsListener = new GpsListener()

export default boot(({ app }) => {
  gpsListener.start()
  // Inject so components can use: this.$gpsListener
  app.config.globalProperties.$gpsListener = gpsListener
})
