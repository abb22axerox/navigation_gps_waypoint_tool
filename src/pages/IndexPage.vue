<template>
  <q-page class="">
    <div>Speed: {{ currentSpeed.toFixed(2) }} knots</div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as CF from "src/utils/calculation_functions";

let currentSpeed = ref(0);
let prevLocation = null;
let prevTime = null;

// Speed calculation
const intervalId = setInterval(() => {
  const currentLocation = CF.get_current_location(); // Use the temporary function
  const currentTime = CF.convert_unit("to-seconds", CF.get_time());

  if (prevLocation && prevTime) {
    const distance = CF.get_2point_route_distance(prevLocation, currentLocation);
    const timeDiff = (currentTime - prevTime) / 3600; // Convert to hours

    if (timeDiff > 0) {
      currentSpeed.value = distance / timeDiff;
    }
  }

  prevLocation = currentLocation;
  prevTime = currentTime;
}, 500);

// Cleanup
onBeforeUnmount(() => {
  clearInterval(intervalId);
});
</script>