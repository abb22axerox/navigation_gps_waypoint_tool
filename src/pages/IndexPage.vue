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
      <!-- Wrap the dashboard and throttle slider in a flex container -->
      <div class="row q-pa-md bordered-container flex-wrapper">
        <!-- Dashboard / Parameters Section -->
        <div class="col-xs-12 col-md-6 q-pa-md dashboard-container">
          <div class="text-h6 q-mb-md">{{ currentGPXFile || 'No route loaded' }}</div>
          
          <div class="row q-col-gutter-md">
            <!-- Primary Stats -->
            <div class="col-6">
              <q-card class="dashboard-card">
                <q-card-section>
                  <div class="text-h3 text-weight-bold text-primary">
                    {{ currentSpeed.toFixed(1) }}
                    <span class="text-caption">knots</span>
                  </div>
                  <div class="text-subtitle2 text-grey-7">Current Speed</div>
                </q-card-section>
              </q-card>
            </div>
            
            <div class="col-6">
              <q-card class="dashboard-card">
                <q-card-section>
                  <div class="text-h3 text-weight-bold text-primary">
                    {{ currentBearing.toFixed(1) }}°
                  </div>
                  <div class="text-subtitle2 text-grey-7">Bearing</div>
                </q-card-section>
              </q-card>
            </div>

            <!-- Navigation Info -->
            <div class="col-12" v-if="estimatedDelay">
              <q-card class="dashboard-card">
                <q-card-section>
                  <div class="row items-center q-col-gutter-md">
                    <div class="col-6">
                      <div class="text-h5 text-weight-medium">
                        {{ estimatedDelay[0].toFixed(2) }} <span class="text-caption">NM</span>
                      </div>
                      <div class="text-subtitle2 text-grey-7">Remaining Distance</div>
                    </div>
                    <div class="col-6">
                      <div class="text-h5" :class="estimatedDelay[2] ? 'text-negative' : 'text-positive'">
                        {{ formatDelay(estimatedDelay[1]) }}
                      </div>
                      <div class="text-subtitle2 text-grey-7">
                        Delay ({{ estimatedDelay[2] ? 'Late' : 'Early' }})
                      </div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>

            <!-- Waypoint Info -->
            <div class="col-12" v-if="isNavigating">
              <q-card class="dashboard-card">
                <q-card-section>
                  <div class="row items-center q-col-gutter-md">
                    <div class="col-6">
                      <div class="text-h5 text-weight-medium">
                        {{ passedWaypointIndex + 1 }} / {{ routeCoordinates.length }}
                      </div>
                      <div class="text-subtitle2 text-grey-7">Current Waypoint</div>
                    </div>
                    <div class="col-6">
                      <div class="text-h5 text-weight-medium">
                        {{ formatTime(etaList[passedWaypointIndex + 1]?.[1]) }}
                      </div>
                      <div class="text-subtitle2 text-grey-7">Must Arrive</div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>
          <!-- Navigation Control -->
          <q-btn
            class="full-width q-mt-md"
            size="lg"
            :color="isNavigating ? 'negative' : 'primary'"
            :label="isNavigating ? 'Stop Navigation' : 'Start Navigation'"
            @click="toggleNavigation"
          />
        </div>

        <!-- Throttle Alert (Slider) Section -->
        <div v-if="estimatedDelay" class="throttle-container">
          <q-slider
            v-model="estimatedDelay[3]"
            :min="-1"
            :max="1"
            :step="0.01"
            readonly
            vertical
            reverse
            color="blue-10"
            track-size="100px"
            class="throttle-slider"
          >
            <!-- Remove default thumb by using an empty thumb slot -->
            <template v-slot:thumb="props"></template>
          </q-slider>              
          <q-icon 
            v-if="estimatedDelay[3] > 1" 
            name="warning" 
            color="negative" 
            size="2em"
            class="warning-icon"
          />
        </div>
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
const startEndIcon = L.divIcon({
  html: '<div style="background:green; width:12px; height:12px; border-radius:50%;"></div>',
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
  if(index === 0 || index === routeCoordinates.value.length - 1) return startEndIcon;
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
  currentGPXFile.value = (localStorage.getItem('currentGPXFileName') || '').replace('.gpx', '');
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

/* Remove shadows from boxes and update basic card styling */
.dashboard-card {
  box-shadow: none;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  transition: none;
}

/* Flex container to align dashboard and slider at the top */
.flex-wrapper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

/* Dashboard container takes available space */
.dashboard-container {
  flex: 1;
}

/* Position the throttle slider to the far right */
.throttle-container {
  margin-left: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Adjust the slider dimensions */
.throttle-slider {
  width: 100px;
  height: 300px;  /* Adjust as necessary to match the height of your parameters */
}

/* Other typography styles */
.text-h3 {
  line-height: 1.2;
}

.text-h5 {
  line-height: 1.2;
}

.text-caption {
  font-size: 0.8em;
  opacity: 0.7;
}

/* Optional: style warning icon */
.warning-icon {
  margin-top: 1rem;
}
</style>