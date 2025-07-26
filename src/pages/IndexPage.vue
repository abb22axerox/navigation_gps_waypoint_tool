<template>
  <q-page class="bg-grey-1">
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

      <!-- Dashboard Section with Slider -->
      <div class="col-6 q-pl-md">
        <div class="row items-start">
          <!-- Main Dashboard Content -->
          <div class="col-10">
            <div class="column q-gutter-y-md">
              <div class="text-h6 q-mb-sm">
                {{ currentGPXFile || "No route loaded" }}
              </div>

              <!-- Cards Row -->
              <div class="row q-col-gutter-md">
                <!-- Current Speed Card -->
                <div class="col-6">
                  <q-card flat bordered class="q-pa-md q-mb-md shadow-2 rounded">
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
                  <q-card flat bordered class="q-pa-md q-mb-md shadow-2 rounded">
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
                  <q-card flat bordered class="q-pa-md q-mb-md shadow-2 rounded">
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

              <!-- Navigation Button -->
              <q-btn
                class="full-width q-mt-md"
                size="lg"
                :color="isNavigating ? 'negative' : 'primary'"
                :label="isNavigating ? 'Stop Navigation' : 'Start Navigation'"
                @click="toggleNavigation"
              />
            </div>
          </div>

          <!-- Throttle Slider -->
          <div class="col-2 q-pt-md q-pl-md flex flex-center">
            <CustomSlider
              v-model="throttleValue"
              :min="-1"
              :max="1"
              :step="0.01"
              readonly
              :show-label="true"
              class="q-mt-md"
            />
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import CustomSlider from 'src/components/CustomSlider.vue';
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import * as CF from 'src/utils/calculation_functions';
import { LMap, LTileLayer, LPolyline, LMarker } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

function formatTime(timeArray) {
  if (!Array.isArray(timeArray)) return '--:--:--';
  const [h, m, s] = timeArray.map(v => String(v).padStart(2, '0'));
  return `${h}:${m}:${s}`;
}

function formatDelay(delay) {
  if (!delay || !Array.isArray(delay)) return '--:--';
  const total = CF.convert_unit('to-seconds', delay);
  const abs = Math.abs(total);
  const mins = Math.floor(abs / 60);
  const secs = Math.floor(abs % 60);
  return `${mins > 0 ? `${mins}min ` : ''}${secs}s`.trim();
}

function createBoatIcon(angle = 0) {
  return L.divIcon({
    html: `<div style="transform: rotate(${angle}deg); font-size: 24px;">&#10148;</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createIndexedDotIcon(index) {
  return L.divIcon({
    html: `<div style="position: relative;">
      <div style="background:red; width:8px; height:8px; border-radius:50%;"></div>
      <div style="position: absolute; top:-12px; left:8px; font-size:12px; background:white; padding:0 2px; border-radius:2px;">${index + 1}</div>
    </div>`,
    className: '',
  });
}

function createIndexedStartEndIcon(index, isLast) {
  return L.divIcon({
    html: `<div style="position: relative;">
      <div style="background:green; width:12px; height:12px; border-radius:50%;"></div>
      <div style="position: absolute; top:-14px; left:12px; font-size:12px; font-weight:bold; background:white; padding:0 2px; border-radius:2px;">${isLast ? 'END' : 'START'}</div>
    </div>`,
    className: '',
  });
}

function getWaypointIcon(index) {
  const isLast = index === routeCoordinates.value.length - 1;
  return index === 0 || isLast
    ? createIndexedStartEndIcon(index, isLast)
    : createIndexedDotIcon(index);
}

function parseTimeString(str) {
  return str.split(':').map(Number).concat(0);
}

const $q = useQuasar();
const isNavigating = ref(localStorage.getItem('isNavigating') === 'true');
const currentSpeed = ref(0);
const currentBearing = ref(0);
const currentGPXFile = ref('');
const zoom = ref(13);
const center = ref([59.75803, 18.62731]);
const routeCoordinates = ref([]);
const currentBoatPos = ref(null);
const boatIcon = ref(createBoatIcon(0));
const mapRef = ref(null);
const passedWaypointIndex = ref(0);
const waypointSwitching = ref(false);
const plannedStartTime = ref(null);
const etaList = ref([]);
const estimatedDelay = ref(null);
const throttleValue = ref(0);

const delayColor = computed(() => {
  const seconds = estimatedDelay.value?.[1];
  if (seconds == null) return '';
  if (seconds <= 3) return 'text-positive';
  if (seconds <= 5) return 'text-warning';
  if (seconds <= 10) return 'text-orange';
  return 'text-negative';
});

watch(estimatedDelay, (newDelay) => {
  if (newDelay?.length) throttleValue.value = newDelay[4];
});

watch(isNavigating, (val) => {
  localStorage.setItem('isNavigating', val);
});

function setNavigationState(active) {
  isNavigating.value = active;
  localStorage.setItem('isNavigating', active);
}

let navigationInterval = null;
let prevPos = null;
let prevTime = null;

async function initializeNavigation() {
  const delayMs = Number(localStorage.getItem('updateFrequency') || 1) * 1000;

  navigationInterval = setInterval(async () => {
    try {
      const pos = await CF.getLiveData('coordinates');
      if (!pos) return;

      center.value = pos;

      currentSpeed.value = await CF.getLiveData('speed') || 0;
      currentBearing.value = currentBoatPos.value ? CF.get_bearing(currentBoatPos.value, pos) : 0;
      boatIcon.value = createBoatIcon(currentBearing.value);
      currentBoatPos.value = pos;
      prevPos = pos;
      prevTime = Date.now() / 1000;

      if (routeCoordinates.value.length > passedWaypointIndex.value + 1 && !waypointSwitching.value) {
        const from = routeCoordinates.value[passedWaypointIndex.value];
        const to = routeCoordinates.value[passedWaypointIndex.value + 1];
        if (await CF.calculate_dot_product(from, to)) {
          waypointSwitching.value = true;
          setTimeout(() => {
            passedWaypointIndex.value++;
            waypointSwitching.value = false;
          }, 1000);
        }
      }

      if (etaList.value.length && plannedStartTime.value) {
        estimatedDelay.value = await CF.get_estimated_delay(
          etaList.value,
          passedWaypointIndex.value,
          currentSpeed.value
        );
      }
    } catch (error) {
      console.warn('Navigation update error:', error);
      stopNavigation();
      $q.notify({ type: 'negative', message: 'Navigation stopped due to error', position: 'top' });
    }
  }, delayMs);
}

async function startNavigation() {
  zoom.value = 15;
  if (!CF.isLiveDataFresh()) {
    $q.dialog({ title: 'Sensor Error', message: 'Stale GPS data', persistent: true });
    return false;
  }

  const pos = await CF.getLiveData('coordinates');
  if (!pos) {
    $q.dialog({ title: 'GPS Error', message: 'No GPS position', persistent: true });
    return false;
  }

  const plannedSpeed = localStorage.getItem('plannedSpeed');
  if (!plannedSpeed) {
    $q.dialog({ title: 'Missing Speed', message: 'Set a planned speed in settings.', persistent: true });
    return false;
  }

  currentBoatPos.value = pos;
  prevPos = pos;
  prevTime = CF.convert_unit('to-seconds', CF.get_time());

  const useNow = localStorage.getItem('useCurrentTime') === 'true';
  plannedStartTime.value = useNow
    ? CF.get_time()
    : parseTimeString(localStorage.getItem('plannedTime') || formatTime(CF.get_time()));

  etaList.value = await CF.get_eta_for_waypoints(plannedStartTime.value, Number(plannedSpeed));
  localStorage.setItem('waypointsETA', JSON.stringify(etaList.value));
  initializeNavigation();
  return true;
}

function stopNavigation() {
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
}

async function toggleNavigation() {
  if (!isNavigating.value) {
    passedWaypointIndex.value = 0;
    if (await startNavigation()) {
      setNavigationState(true);
      $q.notify({ type: 'positive', message: 'Navigation started', position: 'top' });
    }
  } else {
    stopNavigation();
    setNavigationState(false);
    $q.notify({ type: 'warning', message: 'Navigation stopped', position: 'top' });
  }
}

onMounted(async () => {
  console.log(CF.get_bearing([0, 0], [0, 1])); // Should be ~90 (east)
  console.log(CF.get_bearing([0, 0], [1, 0])); // Should be ~0 (north)
  console.log(CF.get_bearing([0, 0], [-1, 0])); // Should be ~180 (south)
  console.log(CF.get_bearing([0, 0], [0, -1])); // Should be ~270 (west)

  currentGPXFile.value = (localStorage.getItem('currentGPXFileName') || '').replace('.gpx', '');

  const coords = await CF.get_route_coordinates();
  if (!coords.length) return;

  routeCoordinates.value = coords;
  center.value = CF.calculateRouteMidpoint(coords);
  passedWaypointIndex.value = 0;

  await nextTick();

  // if (mapRef.value?.mapObject) {
  //   const bounds = L.latLngBounds(coords);
  //   mapRef.value.mapObject.fitBounds(bounds, { padding: [50, 50] });
  // }

  if (isNavigating.value) {
    // Load previously saved ETA list
    const storedETA = localStorage.getItem('waypointsETA');
    if (storedETA) {
      try {
        etaList.value = JSON.parse(storedETA);
      } catch (e) {
        console.warn('Failed to parse ETA list from localStorage:', e);
        etaList.value = [];
      }
    }

    // Restore planned start time
    const useNow = localStorage.getItem('useCurrentTime') === 'true';
    plannedStartTime.value = useNow
      ? CF.get_time()
      : parseTimeString(localStorage.getItem('plannedTime') || formatTime(CF.get_time()));

    currentBoatPos.value = await CF.getLiveData('coordinates');
    prevPos = currentBoatPos.value;
    prevTime = CF.convert_unit('to-seconds', CF.get_time());

    // Only start if all required data is present
    if (etaList.value.length && routeCoordinates.value.length && plannedStartTime.value) {
      await initializeNavigation();
    } else {
      console.warn('Navigation was restored but ETA or route is missing.');
    }
  }
});


onBeforeUnmount(() => {
  stopNavigation();
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
