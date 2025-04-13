<template>
  <q-page class="">
    <div class="row justify-between q-pa-md bordered-container">
      <div class="map-container" v-if="routeCoordinates.length">
        <l-map ref="mapRef" v-model:zoom="zoom" :center="center">
          <l-tile-layer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          ></l-tile-layer>
          <l-polyline
            :lat-lngs="routeCoordinates"
            color="blue"
          ></l-polyline>
          <!-- Waypoint markers -->
          <l-marker
            v-for="(point, index) in routeCoordinates" 
            :key="index" 
            :lat-lng="point" 
            :icon="dotIcon"
          />
          <!-- Navigation boat marker -->
          <l-marker 
            v-if="isNavigating && currentBoatPos"
            :lat-lng="currentBoatPos"
            :icon="boatIcon"
          />
        </l-map>
      </div>
      <div class="col-xs-12 col-md-6">
        <div class="text-h6">{{ currentGPXFile || 'No route loaded' }}</div>
        <div>{{ currentSpeed.toFixed(2) }} knots</div>
        <q-btn
          size="xl"
          class="q-mt-md"
          :color="isNavigating ? 'negative' : 'primary'"
          :label="isNavigating ? 'Stop Navigation' : 'Start Navigation'"
          @click="toggleNavigation"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useQuasar } from 'quasar'  // Add this import
import * as CF from "src/utils/calculation_functions";
import { LMap, LTileLayer, LPolyline, LMarker } from '@vue-leaflet/vue-leaflet';
import "leaflet/dist/leaflet.css";
import L from 'leaflet';

// Icons
const dotIcon = L.divIcon({
  html: '<div style="background:red; width:8px; height:8px; border-radius:50%;"></div>',
  className: '',
  iconSize: [8, 8]
});

function createBoatIcon(angle = 0) {
  return L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size: 24px; line-height:1;">&#10148;</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

// State
const currentSpeed = ref(0);
const currentGPXFile = ref('');
const isNavigating = ref(localStorage.getItem('isNavigating') === 'true');
const zoom = ref(13);
const center = ref([59.75803, 18.62731]);
const routeCoordinates = ref([]);
const currentBoatPos = ref(null);
const boatIcon = ref(createBoatIcon(0));
const mapRef = ref(null);
const $q = useQuasar();  // Add this line

// Intervals
let navigationInterval = null;
let prevPos = null;
let prevTime = null;

// Load route data and restore navigation if active
onMounted(async () => {
  currentGPXFile.value = localStorage.getItem('currentGPXFileName') || '';
  const coordinates = await CF.get_route_coordinates();
  if (coordinates.length) {
    routeCoordinates.value = coordinates;
    center.value = CF.calculateRouteMidpoint(coordinates);
    await nextTick();
    if (mapRef.value?.mapObject) {
      mapRef.value.mapObject.whenReady(() => {
        const bounds = L.latLngBounds(coordinates);
        mapRef.value.mapObject.fitBounds(bounds, { padding: [50, 50] });
      });
    }

    // Restore navigation state without recalculating ETA
    if (isNavigating.value) {
      const initialPos = CF.get_current_location();
      currentBoatPos.value = initialPos;
      prevPos = initialPos;
      
      // Start position and speed updates without ETA calculation
      navigationInterval = setInterval(() => {
        const newPos = CF.get_current_location();
        const bearing = currentBoatPos.value ? 
          CF.get_bearing(currentBoatPos.value, newPos) : 0;
        
        if (prevPos && prevTime) {
          const distance = CF.get_2point_route_distance(prevPos, newPos);
          const timeDiff = (CF.convert_unit("to-seconds", CF.get_time()) - prevTime) / 3600;
          if (timeDiff > 0) {
            currentSpeed.value = distance / timeDiff;
          }
        }

        boatIcon.value = createBoatIcon(bearing);
        currentBoatPos.value = newPos;
        prevPos = newPos;
        prevTime = CF.convert_unit("to-seconds", CF.get_time());
      }, 1000);
    }
  }
});

// Helper function to start navigation
async function startNavigation() {
  // Check if planned speed is set
  const plannedSpeed = localStorage.getItem('plannedSpeed');
  if (!plannedSpeed) {
    $q.dialog({
      title: 'Error',
      message: 'Please set planned speed in settings before starting navigation.',
      persistent: true,
      ok: {
        label: 'OK',
        flat: true
      }
    });
    isNavigating.value = false;
    localStorage.setItem('isNavigating', false);
    return;
  }

  const initialPos = CF.get_current_location();
  currentBoatPos.value = initialPos;
  prevPos = initialPos;
  
  // Calculate ETA list once at navigation start using planned speed
  const etaList = await CF.get_eta_for_waypoints(CF.get_time(), Number(plannedSpeed));
  localStorage.setItem('waypointsETA', JSON.stringify(etaList));
  
  // Start position and speed updates
  navigationInterval = setInterval(() => {
    const newPos = CF.get_current_location();
    const bearing = currentBoatPos.value ? 
      CF.get_bearing(currentBoatPos.value, newPos) : 0;
    
    // Update speed calculation within the same interval
    if (prevPos && prevTime) {
      const distance = CF.get_2point_route_distance(prevPos, newPos);
      const timeDiff = (CF.convert_unit("to-seconds", CF.get_time()) - prevTime) / 3600;
      if (timeDiff > 0) {
        currentSpeed.value = distance / timeDiff;
      }
    }

    boatIcon.value = createBoatIcon(bearing);
    currentBoatPos.value = newPos;
    prevPos = newPos;
    prevTime = CF.convert_unit("to-seconds", CF.get_time());
  }, 1000);
}

// Toggle navigation mode
function toggleNavigation() {
  isNavigating.value = !isNavigating.value;
  localStorage.setItem('isNavigating', isNavigating.value);

  if (isNavigating.value) {    
    startNavigation();
    $q.notify({
      type: 'positive',
      message: 'Navigation started',
      position: 'top',
      timeout: 2000
    });
  } else {
    clearInterval(navigationInterval);
    navigationInterval = null;
    currentBoatPos.value = null;
    prevPos = null;
    prevTime = null;
    currentSpeed.value = 0;
    localStorage.removeItem('waypointsETA');
    $q.notify({
      type: 'warning',
      message: 'Navigation stopped',
      position: 'top',
      timeout: 2000
    });
  }
}

// Cleanup
onBeforeUnmount(() => {
  // Only clear navigation interval
  if (navigationInterval) {
    clearInterval(navigationInterval);
  }
});
</script>

<style>
.map-container {
  width: 600px;
  height: 400px;
  z-index: 0;
}

.leaflet-pane {
  z-index: 0 !important;
}
.leaflet-control {
  z-index: 0 !important;
}
</style>