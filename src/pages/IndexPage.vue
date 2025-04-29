<template>
  <q-page>
    <div class="row justify-between q-pa-md">
      <!-- Map Section -->
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
            :lat-lngs="[routeCoordinates[passedWaypointIndex], routeCoordinates[passedWaypointIndex + 1]]"
            color="green"
            dashArray="5, 5"
          />

          <!-- Visualize boat vector from passed waypoint (red dashed vector) -->
          <l-polyline
            v-if="isNavigating && currentBoatPos && routeCoordinates.length > passedWaypointIndex"
            :lat-lngs="[routeCoordinates[passedWaypointIndex], currentBoatPos]"
            color="red"
            dashArray="5, 5"
          />
        </l-map>
      </div>

      <!-- Dashboard Section -->
      <div class="col-6 q-pl-md">
        <div class="column full-width q-gutter-y-md">
          <div class="text-h6">
            {{ currentGPXFile || "No route loaded" }}
          </div>

          <!-- Throttle Slider -->
          <div class="q-px-md q-mb-md">
            <CustomSlider
              v-model="throttleValue"
              :min="-1"
              :max="1"
              :step="0.01"
              readonly
              :show-label="true"
            />
          </div>

          <div class="row q-pt-md q-col-gutter-md">
            <!-- Current Speed Card -->
            <div class="col-6">
              <q-card class="dashboard-card">
                <q-card-section>
                  <div class="text-h4 text-weight-bold text-primary">
                    {{ (isNavigating ? currentSpeed : 0)?.toFixed(1) || "0.0" }}
                    <span class="text-caption">knots</span>
                  </div>
                  <div class="text-subtitle2 text-grey-7">Current Speed</div>
                </q-card-section>
              </q-card>
            </div>

            <!-- Delay Card -->
            <div class="col-6">
              <q-card class="dashboard-card">
                <q-card-section>
                  <div class="text-h4 text-weight-bold" :class="delayColor">
                    {{ isNavigating ? (estimatedDelay ? formatDelay(estimatedDelay[2]) : "--:--") : "0:00" }}
                    <span class="text-caption">
                      {{
                        isNavigating
                          ? (estimatedDelay?.length ? (estimatedDelay[3] ? "Late" : "Early") : "On Time")
                          : "--"
                      }}
                    </span>
                  </div>
                  <div class="text-subtitle2 text-grey-7">Delay</div>
                </q-card-section>
              </q-card>
            </div>

            <!-- Waypoint Info Card -->
            <div class="col-12">
              <q-card class="dashboard-card">
                <q-card-section>
                  <div class="row justify-between items-center">
                    <div class="col">
                      <div class="text-h5 text-weight-medium text-center">
                        {{
                          isNavigating
                            ? `${passedWaypointIndex + 1} / ${routeCoordinates.length}`
                            : "0 / 0"
                        }}
                      </div>
                      <div class="text-subtitle2 text-grey-7 text-center">
                        Next Waypoint
                      </div>
                    </div>
                    <div class="col">
                      <div class="text-h5 text-weight-medium text-center">
                        {{
                          isNavigating && estimatedDelay && typeof estimatedDelay[0] === 'number'
                            ? estimatedDelay[0].toFixed(2)
                            : "0.00"
                        }}
                        <span class="text-caption">NM</span>
                      </div>
                      <div class="text-subtitle2 text-grey-7 text-center">
                        Remaining Distance
                      </div>
                    </div>
                    <div class="col">
                      <div class="text-h5 text-weight-medium text-center">
                        {{
                          isNavigating && etaList[passedWaypointIndex + 1]
                            ? formatTime(etaList[passedWaypointIndex + 1][1])
                            : "--:--:--"
                        }}
                      </div>
                      <div class="text-subtitle2 text-grey-7 text-center">
                        Must Arrive
                      </div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <q-btn
            class="full-width q-mt-md"
            size="lg"
            :color="isNavigating ? 'negative' : 'primary'"
            :label="isNavigating ? 'Stop Navigation' : 'Start Navigation'"
            @click="toggleNavigation"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import CustomSlider from 'src/components/CustomSlider.vue';
import { gpsListener } from "src/boot/gps-listener";
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from "vue";
import { useQuasar } from "quasar";
import * as CF from "src/utils/calculation_functions";
import { LMap, LTileLayer, LPolyline, LMarker } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Helper functions
function formatTime(timeArray) {
  if (!timeArray || !Array.isArray(timeArray)) return "--:--:--";
  const [hours, minutes, seconds] = timeArray;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, "0")).join(":");
}

function formatDelay(delay) {
  if (!delay || !Array.isArray(delay)) return "--:--";
  const totalSeconds = CF.convert_unit("to-seconds", delay);
  const absSeconds = Math.abs(totalSeconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = Math.floor(absSeconds % 60);
  let timeStr = "";
  if (mins > 0) timeStr += `${mins}min `;
  if (secs > 0 || mins === 0) timeStr += `${secs}s`;
  return timeStr.trim();
}

// Icon definitions
const dotIcon = L.divIcon({
  html: '<div style="background:red; width:8px; height:8px; border-radius:50%;"></div>',
  className: "",
  iconSize: [8, 8],
});
const startEndIcon = L.divIcon({
  html: '<div style="background:green; width:12px; height:12px; border-radius:50%;"></div>',
  className: "",
  iconSize: [12, 12],
});

function createBoatIcon(angle = 0) {
  return L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size: 24px; line-height:1;">&#10148;</div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createIndexedDotIcon(index) {
  return L.divIcon({
    html: `
      <div style="position: relative;">
        <div style="background:red; width:8px; height:8px; border-radius:50%;"></div>
        <div style="position: absolute; top:-12px; left:8px; font-size:12px; background:white; padding:0 2px; border-radius:2px;">
          ${index + 1}
        </div>
      </div>
    `,
    className: "",
    iconSize: [8, 8],
  });
}

function createIndexedStartEndIcon(index, isLast) {
  return L.divIcon({
    html: `
      <div style="position: relative;">
        <div style="background:green; width:12px; height:12px; border-radius:50%;"></div>
        <div style="position: absolute; top:-14px; left:12px; font-size:12px; font-weight:bold; background:white; padding:0 2px; border-radius:2px;">
          ${isLast ? "END" : "START"}
        </div>
      </div>
    `,
    className: "",
    iconSize: [12, 12],
  });
}

function getWaypointIcon(index) {
  const isLast = index === routeCoordinates.value.length - 1;
  if (index === 0 || isLast) {
    return createIndexedStartEndIcon(index, isLast);
  }
  return createIndexedDotIcon(index);
}

// Reactive state
const currentSpeed = ref(0);
const currentBearing = ref(0);
const currentGPXFile = ref("");
const isNavigating = ref(localStorage.getItem("isNavigating") === "true");
const zoom = ref(13);
const center = ref([59.75803, 18.62731]);
const routeCoordinates = ref([]);
const currentBoatPos = ref(null);
const boatIcon = ref(createBoatIcon(0));
const mapRef = ref(null);
const $q = useQuasar();

const passedWaypointIndex = ref(0);
const waypointSwitching = ref(false);
const plannedStartTime = ref(null);
const etaList = ref([]);
const estimatedDelay = ref(null);
const throttleValue = ref(0);

// Assuming estimatedDelay is set by get_estimated_delay and has at least 5 elements:
const delayColor = computed(() => {
  if (!estimatedDelay.value || estimatedDelay.value.length < 5) return '';
  let seconds = estimatedDelay.value[1]; // raw delay seconds
  // Use absolute seconds regardless of early or late.
  if (seconds <= 3) return 'text-positive'; // green: ~3 seconds
  else if (seconds <= 5) return 'text-warning'; // yellow: a little more
  else if (seconds <= 10) return 'text-orange'; // orange: moderate delay
  else return 'text-negative'; // red: over 10 seconds
});

// Update the estimatedDelay watcher to update throttle
watch(() => estimatedDelay.value, (newDelay) => {
  if (newDelay?.length) {
    // Use index 4 (throttle_alert) instead of index 3
    throttleValue.value = newDelay[4];
  }
});

let navigationInterval = null;
let prevPos = null;
let prevTime = null;

// Navigation update function
async function initializeNavigation() {
  try {
    navigationInterval = setInterval(async () => {
      try {
        const newPos = await CF.get_current_location();
        if (!newPos) return;
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
        if (routeCoordinates.value.length > passedWaypointIndex.value + 1 && !waypointSwitching.value) {
          const passed_waypoint = routeCoordinates.value[passedWaypointIndex.value];
          const next_waypoint = routeCoordinates.value[passedWaypointIndex.value + 1];
          if (CF.calculate_dot_product(passed_waypoint, next_waypoint)) {
            waypointSwitching.value = true;
            setTimeout(() => {
              passedWaypointIndex.value++;
              waypointSwitching.value = false;
            }, 1000);
          }
        }
        if (etaList.value.length && plannedStartTime.value) {
          CF.get_estimated_delay(
            etaList.value,
            passedWaypointIndex.value,
            currentSpeed.value
          ).then((result) => {
            estimatedDelay.value = result;
          });
        }
      } catch (error) {
        console.warn("Navigation update error:", error);
        if (error.message.includes("No Listener")) {
          toggleNavigation();
          $q.notify({
            type: "negative",
            message: "Navigation stopped due to connection error",
            position: "top",
            timeout: 3000,
          });
        }
      }
    }, 1000);
  } catch (error) {
    console.error("Navigation initialization error:", error);
    isNavigating.value = false;
  }
}

// Time string parser helper
function parseTimeString(timeStr) {
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  return [hours, minutes, seconds, 0];
}

function handleGpsDisconnect() {
  if (isNavigating.value) {
    $q.notify({
      type: "negative",
      message: "Navigation stopped: GPS2IP connection lost",
      position: "top",
      timeout: 3000,
    });
    // Stop navigation
    clearInterval(navigationInterval);
    navigationInterval = null;
    currentBoatPos.value = null;
    prevPos = null;
    prevTime = null;
    currentSpeed.value = 0;
    localStorage.setItem("isNavigating", false);
    isNavigating.value = false;
  }
}

async function verifyGpsConnection() {
  if (!gpsListener.isConnected) {
    // Try to restart the connection
    gpsListener.stop();
    gpsListener.start();
    
    // Wait for connection to establish
    await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      
      const onConnect = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      
      gpsListener.once('connected', onConnect);
    });
  }
  return gpsListener.isConnected;
}

onMounted(async () => {
  // Listen for disconnect or error events from gpsListener.
  gpsListener.on('disconnected', handleGpsDisconnect);
  gpsListener.on('error', (err) => {
    console.error("GPS error from listener:", err);
    handleGpsDisconnect();
  });
  
  currentGPXFile.value = (localStorage.getItem("currentGPXFileName") || "").replace(".gpx", "");
  const coordinates = await CF.get_route_coordinates();
  if (coordinates.length) {
    routeCoordinates.value = coordinates;
    center.value = CF.calculateRouteMidpoint(coordinates);
    passedWaypointIndex.value = 0;
    await nextTick();
    if (mapRef.value?.mapObject) {
      mapRef.value.mapObject.whenReady(() => {
        const bounds = L.latLngBounds(coordinates);
        mapRef.value.mapObject.fitBounds(bounds, { padding: [50, 50] });
      });
    }
    if (isNavigating.value) {
      const initialPos = await CF.get_current_location();
      currentBoatPos.value = initialPos;
      prevPos = initialPos;
      prevTime = CF.convert_unit("to-seconds", CF.get_time());
      const storedETA = localStorage.getItem("waypointsETA");
      if (storedETA) {
        etaList.value = JSON.parse(storedETA);
      }
      const useCurrentTime = localStorage.getItem("useCurrentTime") === "true";
      if (useCurrentTime) {
        plannedStartTime.value = CF.get_time();
      } else {
        const savedTime = localStorage.getItem("plannedTime");
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

async function startNavigation() {
  console.log('GPS2IP connected:', gpsListener.isConnected);
  if (!gpsListener.isConnected) {
    $q.dialog({
      title: "Error",
      message: "GPS2IP is not connected. Please check your connection.",
      persistent: true,
      ok: { label: "OK", flat: true },
    });
    isNavigating.value = false;
    localStorage.setItem("isNavigating", false);
    return false;
  }
  
  // Then check if a valid initial position is available
  let initialPos;
  try {
    initialPos = await CF.get_current_location();
    if (!initialPos) {
      $q.dialog({
        title: "Error",
        message: "No GPS data available.",
        persistent: true,
        ok: { label: "OK", flat: true },
      });
      isNavigating.value = false;
      localStorage.setItem("isNavigating", false);
      return false;
    }
  } catch (err) {
    $q.dialog({
      title: "Error",
      message: "Could not get GPS position. Please check your GPS2IP connection.",
      persistent: true,
      ok: { label: "OK", flat: true },
    });
    isNavigating.value = false;
    localStorage.setItem("isNavigating", false);
    return false;
  }
  const plannedSpeed = localStorage.getItem("plannedSpeed");
  if (!plannedSpeed) {
    $q.dialog({
      title: "Error",
      message: "Please set planned speed in settings before starting navigation.",
      persistent: true,
      ok: { label: "OK", flat: true },
    });
    isNavigating.value = false;
    localStorage.setItem("isNavigating", false);
    return false;
  }
  currentBoatPos.value = initialPos;
  prevPos = currentBoatPos.value;
  prevTime = CF.convert_unit("to-seconds", CF.get_time());
  const useCurrentTime = localStorage.getItem("useCurrentTime") === "true";
  if (useCurrentTime) {
    plannedStartTime.value = CF.get_time();
  } else {
    const savedTime = localStorage.getItem("plannedTime");
    if (!savedTime) {
      $q.dialog({
        title: "Error",
        message: "Please set planned time in settings before starting navigation.",
        persistent: true,
        ok: { label: "OK", flat: true },
      });
      isNavigating.value = false;
      localStorage.setItem("isNavigating", false);
      return false;
    }
    plannedStartTime.value = parseTimeString(savedTime);
  }
  etaList.value = await CF.get_eta_for_waypoints(plannedStartTime.value, Number(plannedSpeed));
  // Save ETAs to localStorage when navigation starts
  localStorage.setItem("waypointsETA", JSON.stringify(etaList.value));
  
  initializeNavigation();
  return true;
}

async function toggleNavigation() {
  if (!isNavigating.value) {
    // Verify GPS connection before starting
    const isConnected = await verifyGpsConnection();
    if (!isConnected) {
      $q.dialog({
        title: "Error",
        message: "GPS2IP is not connected. Please check your connection.",
        persistent: true,
        ok: { label: "OK", flat: true },
      });
      return;
    }
  }

  isNavigating.value = !isNavigating.value;
  localStorage.setItem("isNavigating", isNavigating.value);
  
  if (isNavigating.value) {
    // Reset navigation state before starting
    passedWaypointIndex.value = 0;
    waypointSwitching.value = false;
    estimatedDelay.value = null;
    throttleValue.value = 0;
    currentSpeed.value = 0;
    currentBearing.value = 0;
    
    const success = await startNavigation();
    if (success) {
      $q.notify({
        type: "positive",
        message: "Navigation started",
        position: "top",
        timeout: 2000,
      });
    }
  } else {
    // Clean up navigation state
    clearInterval(navigationInterval);
    navigationInterval = null;
    currentBoatPos.value = null;
    prevPos = null;
    prevTime = null;
    currentSpeed.value = 0;
    currentBearing.value = 0;
    passedWaypointIndex.value = 0;
    waypointSwitching.value = false;
    estimatedDelay.value = null;
    throttleValue.value = 0;
    etaList.value = [];
    // Clear ETAs from localStorage when navigation stops
    localStorage.removeItem("waypointsETA");
    
    $q.notify({
      type: "warning",
      message: "Navigation stopped",
      position: "top",
      timeout: 2000,
    });
  }
}

onBeforeUnmount(() => {
  gpsListener.off('disconnected', handleGpsDisconnect);
  // It’s a good idea to also remove the error listener.
  gpsListener.off('error', handleGpsDisconnect);
});
</script>

<style>
.map-container {
  width: 50%;
  height: 400px;
  z-index: 0;
}
.leaflet-pane {
  z-index: 0 !important;
}
.leaflet-control {
  z-index: 0 !important;
}
.leaflet-div-icon {
  background: transparent;
  border: none;
}
.dashboard-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
}
.text-orange {
    color: orange;
  }
</style>