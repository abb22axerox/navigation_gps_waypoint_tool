<template>
  <q-page class="bg-grey-1">
    <div class="row justify-between q-pa-sm">
      <!-- Map Section -->
      <div class="map-container" v-if="routeCoordinates.length">
        <l-map ref="mapRef" v-model:zoom="zoom" :center="center">
          <l-tile-layer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          ></l-tile-layer>

          <l-polyline :lat-lngs="routeCoordinates" color="blue" />
          <l-marker
            v-for="(point, index) in routeCoordinates"
            :key="index"
            :lat-lng="point"
            :icon="getWaypointIcon(index)"
          />
          <l-marker
            v-if="isNavigating && currentBoatPos"
            :lat-lng="currentBoatPos"
            :icon="boatIcon"
          />
          <l-polyline
            v-if="isNavigating && routeCoordinates.length > passedWaypointIndex + 1"
            :lat-lngs="[routeCoordinates[passedWaypointIndex], routeCoordinates[passedWaypointIndex + 1]]"
            color="green"
            dashArray="5, 5"
          />
          <!-- <l-polyline
            v-if="isNavigating && currentBoatPos && routeCoordinates.length > passedWaypointIndex"
            :lat-lngs="[routeCoordinates[passedWaypointIndex], currentBoatPos]"
            color="red"
            dashArray="5, 5"
          /> -->
          <l-polyline
            v-if="currentBoatPos"
            :lat-lngs="projectedCourseLine"
            color="darkblue"
            dashArray="3, 6"
          />
          <l-polyline
            v-if="isNavigating && waypointCutLine.length === 2"
            :lat-lngs="waypointCutLine"
            color="red"
            dashArray="3, 6"
          />
          <!-- <l-marker
            v-if="currentBoatPos && lastDotProduct !== null"
            :lat-lng="currentBoatPos"
            :icon="getDotProductIcon"
          /> -->
        </l-map>
      </div>

      <!-- Dashboard Section -->
      <div class="col-6 q-pl-md">
        <div class="row items-start">
          <div class="col-10">
            <div class="column q-gutter-y-md">
              <div class="text-h6 q-mb-sm">
                {{ currentGPXFile || "No route loaded" }}
              </div>

              <!-- Row of auto-stretch cards -->
              <div class="row q-col-gutter-md items-stretch">
                <!-- Speed -->
                <div class="col-4">
                  <q-card flat bordered class="shadow-2 rounded" style="height: 100%;">
                    <q-card-section>
                      <div class="text-h5 text-weight-bold text-primary">
                        {{ (isNavigating ? currentSpeed : 0)?.toFixed(1) || "0.0" }}
                        <span class="text-caption">knots</span>
                      </div>
                      <div class="text-subtitle2 text-grey-7">Speed</div>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Course -->
                <div class="col-4">
                  <q-card flat bordered class="shadow-2 rounded" style="height: 100%;">
                    <q-card-section class="column justify-between">
                      <div class="row items-center q-gutter-sm">
                        <div
                          :style="{
                            transform: `rotate(${currentCourse - 90}deg)`,
                            fontSize: '24px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: '#1976D2'
                          }"
                        >
                          &#10148;
                        </div>
                        <div class="text-h5 text-weight-bold text-primary">
                          {{ isNavigating ? currentCourse.toFixed(0) : '0' }}°
                        </div>
                      </div>
                      <div class="text-subtitle2 text-grey-7">Course</div>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Delay -->
                <div class="col-4">
                  <q-card flat bordered class="shadow-2 rounded" style="height: 100%;">
                    <q-card-section>
                      <div class="text-h5 text-weight-bold" :class="delayColor">
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
              </div>

              <!-- Waypoint Info -->
              <div class="col-12">
                <q-card flat bordered class="q-pa-md shadow-2 rounded">
                  <q-card-section>
                    <div class="row justify-between items-center">
                      <div class="col text-center">
                        <div class="text-h5 text-weight-medium">
                          {{
                            isNavigating
                              ? `${passedWaypointIndex + 2} / ${routeCoordinates.length}`
                              : "0 / 0"
                          }}
                        </div>
                        <div class="text-subtitle2 text-grey-7">Next Waypoint</div>
                      </div>
                      <div class="col text-center">
                        <div class="text-h5 text-weight-medium">
                          {{
                            isNavigating && estimatedDelay && typeof estimatedDelay[0] === 'number'
                              ? estimatedDelay[0].toFixed(2)
                              : "0.00"
                          }}
                          <span class="text-caption">NM</span>
                        </div>
                        <div class="text-subtitle2 text-grey-7">Remaining Distance</div>
                      </div>
                      <div class="col text-center">
                        <div class="text-h5 text-weight-medium">
                          {{
                            isNavigating && etaList[passedWaypointIndex + 1]
                              ? formatTime(etaList[passedWaypointIndex + 1][1])
                              : "--:--:--"
                          }}
                        </div>
                        <div class="text-subtitle2 text-grey-7">Must Arrive</div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
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
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed, watchEffect } from 'vue';
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
    html: `<div style="transform: rotate(${angle - 90}deg); font-size: 24px;">&#10148;</div>`,
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

// const getDotProductIcon = computed(() => {
//   const color = lastDotProduct.value > 0 ? 'green' : 'orange';
//   return L.divIcon({
//     html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%;"></div>`,
//     className: '',
//     iconSize: [12, 12],
//     iconAnchor: [6, 6],
//   });
// });

const projectedCourseLine = computed(() => {
  if (!currentBoatPos.value) return [];

  const [lat, lng] = currentBoatPos.value;
  const distanceNm = 0.2;
  const courseRad = (currentCourse.value * Math.PI) / 180;
  const R = 3440;
  const deltaLat = (distanceNm / R) * (180 / Math.PI) * Math.cos(courseRad);
  const deltaLng = (distanceNm / R) * (180 / Math.PI) * Math.sin(courseRad) / Math.cos((lat * Math.PI) / 180);

  return [
    [lat, lng],
    [lat + deltaLat, lng + deltaLng],
  ];
});

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
const currentCourse = ref(0);
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
const lastDotProduct = ref(null);
const waypointCutLine = ref([]);

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
let crossing_extension;

async function initializeNavigation() {
  const delayMs = Number(localStorage.getItem('updateFrequency') || 1) * 1000;

  let wasDotPositive = false;        // ← added for hysteresis logic
  const epsilon = 1e-3;              // ← deadband threshold

  navigationInterval = setInterval(async () => {
    try {
      const pos = await CF.getLiveData('coordinates');
      if (!pos) return;

      // ── Update boat state ─────────────────────────────────────────
      center.value = pos;
      currentSpeed.value = (await CF.getLiveData('speed')) || 0;
      currentCourse.value = (await CF.getLiveData('course')) || 0;
      boatIcon.value = createBoatIcon(currentCourse.value);
      currentBoatPos.value = pos;
      prevPos = pos;
      prevTime = Date.now() / 1000;

      // ── Only if we have at least 3 points ahead ────────────────────
      if (
        routeCoordinates.value.length > passedWaypointIndex.value + 2 &&
        !waypointSwitching.value
      ) {
        const i = passedWaypointIndex.value;
        const p1 = routeCoordinates.value[i];       // WP4 (just passed)
        const p2 = routeCoordinates.value[i + 1];   // WP5 (heading toward)
        const p3 = routeCoordinates.value[i + 2];   // WP6

        const crossing_extension = Number(localStorage.getItem('crossing_extension'));

        // 1) Compute dot and cut-line
        const { dot, cutLine } = await CF.check_crossing_status(p1, p2, p3, crossing_extension);
        lastDotProduct.value = dot;
        waypointCutLine.value = cutLine || [];

        console.log(dot)

        // 2) Hysteresis logic to avoid bouncing near cutline
        if (dot > epsilon && !wasDotPositive) {
          waypointSwitching.value = true;
          setTimeout(() => {
            passedWaypointIndex.value++;
            waypointSwitching.value = false;
          }, 1000);
        }

        if (dot < -epsilon && wasDotPositive) {
          wasDotPositive = false;
        }

        if (dot > epsilon) {
          wasDotPositive = true;
        }
      }

      // ── Recompute ETA/delay ────────────────────────────────────────
      if (etaList.value.length && plannedStartTime.value) {
        estimatedDelay.value = await CF.get_estimated_delay(
          etaList.value,
          passedWaypointIndex.value + 1,
          currentSpeed.value
        );
      }

    } catch (error) {
      console.warn('Navigation update error:', error);
      stopNavigation();
      $q.notify({
        type: 'negative',
        message: 'Navigation stopped due to error',
        position: 'top'
      });
    }
  }, delayMs);
}

async function startNavigation() {
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

  // Get crossing_extension from localStorage
  const crossingExtensionRaw = localStorage.getItem('crossing_extension');
  if (!crossingExtensionRaw) {
    $q.dialog({ title: 'Missing Crossing Extension', message: 'Set a crossing extension in settings.', persistent: true });
    return false;
  }
  crossing_extension = Number(crossingExtensionRaw);

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
  currentCourse.value = 0;
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
  currentGPXFile.value = (localStorage.getItem('currentGPXFileName') || '').replace('.gpx', '');

  const coords = await CF.get_route_coordinates();
  if (!coords.length) return;

  routeCoordinates.value = coords;
  center.value = CF.calculateRouteMidpoint(coords);
  passedWaypointIndex.value = 0;

  await nextTick();

  if (isNavigating.value) {
    const storedETA = localStorage.getItem('waypointsETA');
    if (storedETA) {
      try {
        etaList.value = JSON.parse(storedETA);
      } catch (e) {
        console.warn('Failed to parse ETA list from localStorage:', e);
        etaList.value = [];
      }
    }

    const useNow = localStorage.getItem('useCurrentTime') === 'true';
    plannedStartTime.value = useNow
      ? CF.get_time()
      : parseTimeString(localStorage.getItem('plannedTime') || formatTime(CF.get_time()));

    currentBoatPos.value = await CF.getLiveData('coordinates');
    prevPos = currentBoatPos.value;
    prevTime = CF.convert_unit('to-seconds', CF.get_time());

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
