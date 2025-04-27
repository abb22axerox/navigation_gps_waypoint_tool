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
    this.hasReceivedData = false; // Add this new flag
  }

  start() {
    if (this.socket?.readyState === WebSocket.OPEN) return
    
    try {
      this.socket = new WebSocket('ws://localhost:3001')

      this.socket.onopen = () => {
        console.log('🌐 Connected to GPS bridge');
        // Don't set isConnected here, wait for actual data
        this.reconnectAttempts = 0;
        this.startDataCheck();
      };

      this.socket.onmessage = (event) => {
        const nmeaData = event.data.trim()
        this.lastUpdate = Date.now()
        
        // Only set connected and emit when we get valid NMEA data
        if (!this.hasReceivedData) {
          this.hasReceivedData = true;
          this.isConnected = true;
          this.emit('connected');
        }

        // Process NMEA messages and emit location if valid
        const parts = nmeaData.split(',')
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

          this.latest = [latitude, longitude]
          this.emit('location', this.latest)
        }
      };

      this.socket.onerror = (error) => {
        console.error('GPS WebSocket error:', error);
        this.isConnected = false;
        this.hasReceivedData = false;
        this.emit('error', new Error('GPS WebSocket error'));
      };

      this.socket.onclose = () => {
        if (this.isConnected) {
          console.log('❌ GPS WebSocket closed');
          this.isConnected = false;
          this.hasReceivedData = false;
          this.emit('disconnected');
        }
        this.stopDataCheck();
        this.tryReconnect();
      };
    } catch (error) {
      console.log('Failed to initialize WebSocket:', error)
    }
  }

  startDataCheck() {
    if (this.checkInterval) return;
    
    this.checkInterval = setInterval(() => {
      if (!this.isConnected) return;
      
      const timeSinceLastUpdate = Date.now() - this.lastUpdate;
      if (timeSinceLastUpdate > 5000) {
        console.log('No GPS data received in last 5s');
        this.isConnected = false;
        this.hasReceivedData = false;
        this.emit('error', new Error('GPS data stream stopped'));
        this.stop();
        this.tryReconnect();
      }
    }, 1000);
  }

  stopDataCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => this.start(), 5000);
  }

  stop() {
    this.stopDataCheck();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

export const gpsListener = new GpsListener()

export default boot(({ app }) => {
  gpsListener.start()
  app.config.globalProperties.$gpsListener = gpsListener
})
