import { ref } from 'vue';

export const liveGpsData = ref(null);
export const lastGpsUpdate = ref(Date.now());

export function setupLiveGpsWebSocket() {
  const socket = new WebSocket('ws://localhost:8080');
  socket.onopen = () => console.log("WebSocket connected");
  socket.onmessage = (event) => {
    liveGpsData.value = JSON.parse(event.data);
    lastGpsUpdate.value = Date.now(); // <-- update timestamp on every message
    // console.log("Received GPS data:", liveGpsData.value);
  };
  socket.onerror = (err) => console.error("WebSocket error:", err);
}

// Quasar boot file entry point
export default async () => {
  setupLiveGpsWebSocket();
};
