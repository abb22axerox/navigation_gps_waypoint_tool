<template>
  <q-page class="">
    <div class="row justify-between q-pa-md bordered-container">
      <div class="map-container" v-if="routeCoordinates.length">
        <l-map ref="mapRef" v-model:zoom="zoom" :center="center">
          <l-tile-layer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          ></l-tile-layer>

          <!-- Full route polyline -->
          <l-polyline :lat-lngs="routeCoordinates" color="blue"></l-polyline>

          <!-- Waypoint markers with highlighted start and end -->
          <l-marker
            v-for="(point, index) in routeCoordinates"
            :key="index"
            :lat-lng="point"
            :icon="getWaypointIcon(index)"
          />

          <!-- Navigation boat marker -->
          <l-marker 
            v-if="isNavigating && currentBoatPos"
            :lat-lng="currentBoatPos"
            :icon="boatIcon"
          />

          <!-- Visualize current route segment (green dashed vector) -->
          <l-polyline
            v-if="isNavigating && routeCoordinates.length > passedWaypointIndex + 1"
            :lat-lngs="[ routeCoordinates[passedWaypointIndex], routeCoordinates[passedWaypointIndex + 1] ]"
            color="green"
            dashArray="5, 5"
          />

          <!-- Visualize boat vector from passed waypoint (red dashed vector) -->
          <l-polyline
            v-if="isNavigating && currentBoatPos && routeCoordinates.length > passedWaypointIndex"
            :lat-lngs="[ routeCoordinates[passedWaypointIndex], currentBoatPos ]"
            color="red"
            dashArray="5, 5"
          />
        </l-map>
      </div>
      <div class="col-xs-12 col-md-6">
        <div class="text-h6">{{ currentGPXFile || 'No route loaded' }}</div>
        <div>{{ currentSpeed.toFixed(2) }} knots</div>
        <div>Bearing: {{ currentBearing.toFixed(2) }}°</div>
        <div v-if="estimatedDelay">
          <div>Remaining Distance: {{ estimatedDelay[0].toFixed(2) }} NM</div>
          <div>Delay: {{ formatDelay(estimatedDelay[1]) }}</div>
          <div>{{ estimatedDelay[2] ? 'Late' : 'Early' }}</div>
          <div>Throttle Alert: {{ estimatedDelay[3].toFixed(2) }}</div>
        </div>
        <div v-if="isNavigating">
          <div>Next waypoint: {{ passedWaypointIndex + 1 }} / {{ routeCoordinates.length }}</div>
          <div>Must Arrive: {{ formatTime(etaList[passedWaypointIndex + 1]?.[1]) }}</div>
        </div>
        <q-btn
          size="xl"
          :color="isNavigating ? 'negative' : 'primary'"
          :label="isNavigating ? 'Stop Navigation' : 'Start Navigation'"
          @click="toggleNavigation"
          class="q-mt-md"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useQuasar } from 'quasar';
import * as CF from "src/utils/calculation_functions";
import { LMap, LTileLayer, LPolyline, LMarker } from '@vue-leaflet/vue-leaflet';
import "leaflet/dist/leaflet.css";
import L from 'leaflet';

// Add formatTime helper function at the top of script setup
function formatTime(timeArray) {
  if (!timeArray || !Array.isArray(timeArray)) return '--:--:--'
  const [hours, minutes, seconds] = timeArray
  return [hours, minutes, seconds].map(v => String(v).padStart(2,'0')).join(':')
}

function formatDelay(delay) {
  if (!delay || !Array.isArray(delay)) return '--:--:--'
  const [hours, minutes, seconds, milliseconds] = delay
  const timeStr = [hours, minutes, seconds, Math.floor(milliseconds/10)].map(v => String(v).padStart(2,'0')).join(':')
  return timeStr
}

// Icons
const dotIcon = L.divIcon({
  html: '<div style="background:red; width:8px; height:8px; border-radius:50%;"></div>',
  className: '',
  iconSize: [8, 8]
});
const startIcon = L.divIcon({
  html: '<div style="background:green; width:12px; height:12px; border-radius:50%;"></div>',
  className: '',
  iconSize: [12, 12]
});
const endIcon = L.divIcon({
  html: '<div style="background:red; width:12px; height:12px; border-radius:50%;"></div>',
  className: '',
  iconSize: [12, 12]
});
function createBoatIcon(angle = 0) {
  return L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size: 24px; line-height:1;">&#10148;</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

// Returns the proper icon for a given waypoint index.
function getWaypointIcon(index) {
  if(index === 0) return startIcon;
  if(index === routeCoordinates.value.length - 1) return endIcon;
  return dotIcon;
}

// State
const currentSpeed = ref(0);
const currentBearing = ref(0);
const currentGPXFile = ref('');
const isNavigating = ref(localStorage.getItem('isNavigating') === 'true');
const zoom = ref(13);
const center = ref([59.75803, 18.62731]);
const routeCoordinates = ref([]);
const currentBoatPos = ref(null);
const boatIcon = ref(createBoatIcon(0));
const mapRef = ref(null);
const $q = useQuasar();

// Iterative waypoint state (active only when navigating)
const passedWaypointIndex = ref(0);
const waypointSwitching = ref(false);

// New reactive variables for delay estimation:
const plannedStartTime = ref(null);
const etaList = ref([]);
const estimatedDelay = ref(null);

// Navigation variables
let navigationInterval = null;
let prevPos = null;
let prevTime = null;

/**
 * Helper function that sets up the navigation update interval.
 * It updates boat position, speed, bearing, and handles iterative waypoint logic.
 * Also, it calls get_estimated_delay() to update the estimated delay information.
 */
function initializeNavigation() {
  navigationInterval = setInterval(() => {
    const newPos = CF.get_current_location();
    const bearing = currentBoatPos.value ? CF.get_bearing(currentBoatPos.value, newPos) : 0;
    currentBearing.value = bearing;

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
    
    // Iterative waypoint logic:
    // Here, passed_waypoint is the waypoint at passedWaypointIndex,
    // and next_waypoint is the one immediately after it.
    if (routeCoordinates.value.length > passedWaypointIndex.value + 1 && !waypointSwitching.value) {
      const passed_waypoint = routeCoordinates.value[passedWaypointIndex.value];
      const next_waypoint = routeCoordinates.value[passedWaypointIndex.value + 1];
      if (CF.calculate_dot_product(passed_waypoint, next_waypoint)) {
        waypointSwitching.value = true;
        setTimeout(() => {
          passedWaypointIndex.value++;
          waypointSwitching.value = false;
        }, 1000); // wait one second before switching waypoints.
      }
    }

    // Update the estimated delay if we have an ETA list and planned start time.
    if (etaList.value.length && plannedStartTime.value) {
      CF.get_estimated_delay(plannedStartTime.value, etaList.value, passedWaypointIndex.value, currentSpeed.value)
        .then(result => {
        estimatedDelay.value = result[0];
      });
    }
  }, 1000);
}

// Add helper function to parse time string
function parseTimeString(timeStr) {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number)
  return [hours, minutes, seconds, 0]
}

// onMounted: load route data and restore navigation if active.
onMounted(async () => {
  currentGPXFile.value = localStorage.getItem('currentGPXFileName') || '';
  const coordinates = await CF.get_route_coordinates();
  if (coordinates.length) {
    routeCoordinates.value = coordinates;
    center.value = CF.calculateRouteMidpoint(coordinates);
    // Reset waypoint iteration.
    passedWaypointIndex.value = 0;
    await nextTick();
    if (mapRef.value?.mapObject) {
      mapRef.value.mapObject.whenReady(() => {
        const bounds = L.latLngBounds(coordinates);
        mapRef.value.mapObject.fitBounds(bounds, { padding: [50, 50] });
      });
    }
    // Restore navigation if active.
    if (isNavigating.value) {
      const initialPos = CF.get_current_location();
      currentBoatPos.value = initialPos;
      prevPos = initialPos;
      prevTime = CF.convert_unit("to-seconds", CF.get_time());
      
      const storedETA = localStorage.getItem('waypointsETA');
      if (storedETA) {
        etaList.value = JSON.parse(storedETA);
      }
      
      // Get start time based on settings
      const useCurrentTime = localStorage.getItem('useCurrentTime') === 'true';
      if (useCurrentTime) {
        plannedStartTime.value = CF.get_time();
      } else {
        const savedTime = localStorage.getItem('plannedTime');
        if (savedTime) {
          plannedStartTime.value = parseTimeString(savedTime);
        } else {
          plannedStartTime.value = CF.get_time();
        }
      }
      
      initializeNavigation();
    }
  }
});

// Helper function to start navigation.
async function startNavigation() {
  const plannedSpeed = localStorage.getItem('plannedSpeed');
  if (!plannedSpeed) {
    $q.dialog({
      title: 'Error',
      message: 'Please set planned speed in settings before starting navigation.',
      persistent: true,
      ok: { label: 'OK', flat: true }
    });
    isNavigating.value = false;
    localStorage.setItem('isNavigating', false);
    return;
  }
  
  const initialPos = CF.get_current_location();
  currentBoatPos.value = initialPos;
  prevPos = initialPos;
  prevTime = CF.convert_unit("to-seconds", CF.get_time());
  
  // Get start time based on settings
  const useCurrentTime = localStorage.getItem('useCurrentTime') === 'true';
  if (useCurrentTime) {
    plannedStartTime.value = CF.get_time();
  } else {
    const savedTime = localStorage.getItem('plannedTime');
    if (!savedTime) {
      $q.dialog({
        title: 'Error',
        message: 'Please set planned time in settings before starting navigation.',
        persistent: true,
        ok: { label: 'OK', flat: true }
      });
      isNavigating.value = false;
      localStorage.setItem('isNavigating', false);
      return;
    }
    plannedStartTime.value = parseTimeString(savedTime);
  }
  
  etaList.value = await CF.get_eta_for_waypoints(plannedStartTime.value, Number(plannedSpeed));
  localStorage.setItem('waypointsETA', JSON.stringify(etaList.value));
  
  initializeNavigation();
}

// Toggle navigation mode.
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

// Cleanup on component unmount.
onBeforeUnmount(() => {
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
.bordered-container {
  border: 1px solid #ccc;
  border-radius: 8px;
}
</style>