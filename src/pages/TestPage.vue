<template>
  <div class="p-4">
    <h2 class="text-xl font-bold mb-2">Live GPS Data</h2>
    <div v-if="gps">
      <p><strong>Lat:</strong> {{ gps.lat }}</p>
      <p><strong>Lon:</strong> {{ gps.lon }}</p>
      <p><strong>Speed:</strong> {{ (gps.speed * 1.94384).toFixed(2) }} knots</p>
      <p><strong>Course:</strong> {{ gps.course }}°</p>
      <p><strong>Altitude:</strong> {{ gps.altitude }} m</p>
      <p><strong>Time:</strong> {{ gps.time }}</p>
    </div>
    <div v-else>
      <p>Waiting for GPS data...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const gps = ref(null);
let socket;

onMounted(() => {
  socket = new WebSocket('ws://localhost:8080');
  socket.onmessage = (event) => {
    gps.value = JSON.parse(event.data);
  };
});

onBeforeUnmount(() => {
  if (socket) socket.close();
});
</script>
