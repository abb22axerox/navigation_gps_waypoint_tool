import { boot } from 'quasar/wrappers'
import { EventEmitter } from 'events'

class GpsListener extends EventEmitter {
  constructor() {
    super()
    this.socket = null
    this.latest = null  // will store the latest coordinates
    // Optionally increase max listeners to avoid warnings:
    this.setMaxListeners(20)
  }

  start() {
    this.socket = new WebSocket('ws://localhost:3001')

    this.socket.onmessage = (event) => {
      const nmeaData = event.data.trim()
      console.log('📍 GPS Data from WebSocket:', nmeaData)

      const parts = nmeaData.split(',')
      if (parts[0].includes('$GPRMC') && parts[2] === 'A') {
        // Parse latitude.
        const rawLat = parseFloat(parts[3])
        const latDeg = Math.floor(rawLat / 100)
        const latMin = rawLat % 100
        let latitude = latDeg + latMin / 60
        if (parts[4] === 'S') latitude = -latitude

        // Parse longitude.
        const rawLon = parseFloat(parts[5])
        const lonDeg = Math.floor(rawLon / 100)
        const lonMin = rawLon % 100
        let longitude = lonDeg + lonMin / 60
        if (parts[6] === 'W') longitude = -longitude

        // Store as [longitude, latitude] if that’s your desired order.
        this.latest = [longitude, latitude]
        // Also emit the event so any pending promise resolves.
        this.emit('location', this.latest)
      }
    }

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
