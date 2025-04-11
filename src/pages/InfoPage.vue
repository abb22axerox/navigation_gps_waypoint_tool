<template>
  <q-page class="q-pa-md">
    <!-- <div class="row justify-between"> -->
      <div class="text-h4">Route Information</div>
      <!-- <q-btn class="" color="secondary" icon-right="update" label="Update" @click="updateEtaList" /> -->
    <!-- </div> -->
    <div class="row">
      <div class="q-pa-md text-subtitle">
        <q-markup-table separator="cell" flat bordered>
          <thead>
            <tr>
              <th class="text-left">Waypoint</th>
              <th class="text-left">Coordinate</th>
              <th class="text-left">Estimated Time of Arrival</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in waypoints" :key="index">
              <td class="text-left">{{ index }}</td>
              <td class="text-left">{{ CF.formatCoordinates(item[0]) }}</td>
              <td class="text-left">{{ formatTimeArray(item[1]) }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </div>
      <div class="bordered">
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import * as CF from "src/utils/calculation_functions";

let waypoints = ref([]);

// Load stored ETA on mount
onMounted(() => {
  const storedETA = localStorage.getItem('waypointsETA');
  if (storedETA) {
    waypoints.value = JSON.parse(storedETA);
  }
});

// // Update ETA list function
// async function updateEtaList() {
//   const etaList = await CF.get_eta_for_waypoints(CF.get_time(), 10);
//   waypoints.value = etaList;
//   // Update storage with new values
//   localStorage.setItem('waypointsETA', JSON.stringify(etaList));
// }

function formatTimeArray(timeArray) {
  if (!Array.isArray(timeArray)) return timeArray;
  
  const [hours, minutes, seconds] = timeArray;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
</script>