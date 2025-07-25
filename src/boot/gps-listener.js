import { boot } from 'quasar/wrappers'
import { EventEmitter } from 'events'
import { ref } from 'vue'

const gpsConnected = ref(false)
const lastDataTimestamp = ref(0)
const latestPosition = ref(null) // <-- Add this

class GpsListener extends EventEmitter {
  constructor() {
    super()
    this.socket = null
    this.checkInterval = null
    this.reconnectTimeout = null
    this.isStopped = false
  }

  start() {
    this.isStopped = false
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return

    this.socket = new WebSocket('ws://localhost:3001')

    this.socket.onopen = () => {
      gpsConnected.value = false
      this.startDataCheck()
    }

    this.socket.onmessage = (event) => {
      lastDataTimestamp.value = Date.now()
      gpsConnected.value = true

      // Parse NMEA data for position
      const nmea = event.data.trim()
      const parts = nmea.split(',')
      if (parts[0].includes('$GPRMC') && parts[2] === 'A') {
        // Parse latitude
        const rawLat = parseFloat(parts[3])
        const latDeg = Math.floor(rawLat / 100)
        const latMin = (rawLat % 100) / 60
        let latitude = latDeg + latMin
        if (parts[4] === 'S') latitude = -latitude

        // Parse longitude
        const rawLon = parseFloat(parts[5])
        const lonDeg = Math.floor(rawLon / 100)
        const lonMin = (rawLon % 100) / 60
        let longitude = lonDeg + lonMin
        if (parts[6] === 'W') longitude = -longitude

        latestPosition.value = [latitude, longitude]
      }

      this.emit('location', latestPosition.value)
    }

    this.socket.onerror = () => {
      gpsConnected.value = false
      this.stopDataCheck()
      this.tryReconnect()
    }

    this.socket.onclose = () => {
      gpsConnected.value = false
      this.stopDataCheck()
      this.tryReconnect()
    }
  }

  startDataCheck() {
    if (this.checkInterval) return
    this.checkInterval = setInterval(() => {
      if (Date.now() - lastDataTimestamp.value > 3000) {
        gpsConnected.value = false
      }
    }, 2000)
  }

  stopDataCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  tryReconnect() {
    if (this.isStopped) return
    if (this.reconnectTimeout) return
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.start()
    }, 1000)
  }

  stop() {
    this.isStopped = true
    this.stopDataCheck()
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    gpsConnected.value = false
  }
}

export const gpsListener = new GpsListener()
export { gpsConnected, latestPosition }

export default boot(({ app }) => {
  gpsListener.start()
  app.config.globalProperties.$gpsListener = gpsListener
})
