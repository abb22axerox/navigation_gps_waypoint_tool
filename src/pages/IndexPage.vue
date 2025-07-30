<template>
  <q-page class="bg-grey-1">
    <div class="row justify-between q-pa-sm">

      <!-- Map Section -->
      <div class="map-container" v-if="routeCoordinates.length">
        <l-map ref="mapRef" v-model:zoom="zoom" :center="center">
          <l-tile-layer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
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
            v-if="isNavigating && currentBoatPos && routeCoordinates.length > passedWaypointIndex + 1"
            :lat-lngs="[currentBoatPos, routeCoordinates[passedWaypointIndex + 1]]"
            color="green"
            dashArray="5, 5"
          />

          <l-polyline
            v-if="isNavigating && isFinishSegment"
            :lat-lngs="[routeCoordinates[routeCoordinates.length - 2], routeCoordinates[routeCoordinates.length - 1]]"
            color="green"
          />

          <l-polyline
            v-if="currentBoatPos"
            :lat-lngs="projectedCourseLine"
            color="darkblue"
            dashArray="3, 6"
          />

          <l-polyline
            v-if="isNavigating && waypointCutLine.length === 2 && !isFinishSegment"
            :lat-lngs="waypointCutLine"
            color="red"
            dashArray="3, 6"
          />

          <l-polyline
            v-if="isNavigating && finishCutLine.length === 2 && isFinishSegment"
            :lat-lngs="finishCutLine"
            color="green"
            dash-array="5, 5"
          />
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

              <!-- Speed / Course / Delay row -->
              <div class="row q-col-gutter-md">
                <!-- Speed Card -->
                <div class="col-4">
                  <q-card flat bordered class="shadow-2 rounded full-height">
                    <q-card-section>
                      <div class="text-h5 text-weight-bold text-primary">
                        {{ (isNavigating ? currentSpeed : 0).toFixed(1) }}
                        <span class="text-caption">knots</span>
                      </div>
                      <div class="text-subtitle2 text-grey-9">Speed</div>
                      <div class="text-caption text-grey-8">
                        Target: {{ targetSpeed.toFixed(1) }} knots
                      </div>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Course Card -->
                <div class="col-4">
                  <q-card flat bordered class="shadow-2 rounded full-height">
                    <q-card-section class="column justify-between">
                      <div class="row items-center q-gutter-sm">
                        <div
                          :style="{
                            transform: `rotate(${currentCourse - 90}deg)`,
                            fontSize: '24px', width: '28px', height: '28px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            color: '#1976D2'
                          }"
                        >
                          &#10148;
                        </div>
                        <div class="text-h5 text-weight-bold text-primary">
                          {{ isNavigating ? currentCourse.toFixed(0) : '0' }}°
                        </div>
                      </div>
                      <div class="text-subtitle2 text-grey-9">Course</div>
                      <div class="text-caption text-grey-8">
                        Target: {{ targetCourse.toFixed(0) }}°
                      </div>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Delay Card -->
                <div class="col-4">
                  <q-card flat bordered class="shadow-2 rounded full-height">
                    <q-card-section>
                      <div class="text-h5 text-weight-bold" :class="delayColor">
                        {{
                          isNavigating
                            ? (estimatedDelay ? formatDelay(estimatedDelay[2]) : "--:--")
                            : "0:00"
                        }}
                        <span class="text-caption">
                          {{
                            isNavigating
                              ? (estimatedDelay?.length
                                  ? (
                                      Math.abs(estimatedDelay[1]) < 1
                                        ? "On Time"
                                        : (estimatedDelay[3] ? "Late" : "Early")
                                    )
                                  : "On Time"
                                )
                              : "--"
                          }}
                          </span>
                      </div>
                      <div class="text-subtitle2 text-grey-9">Delay</div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <!-- Waypoint Info Card -->
              <q-card flat bordered class="q-pt-md shadow-2 rounded">
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
                      <div class="text-subtitle2 text-grey-9">Next Waypoint</div>
                    </div>
                    <div class="col text-center">
                      <div class="text-h5 text-weight-medium">
                        {{
                          isNavigating && estimatedDelay
                            ? estimatedDelay[0].toFixed(2)
                            : "0.00"
                        }}
                        <span class="text-caption">NM</span>
                      </div>
                      <div class="text-subtitle2 text-grey-9">Remaining Distance</div>
                    </div>
                    <div class="col text-center">
                      <div class="text-h5 text-weight-medium">
                        {{
                          isNavigating && etaList[passedWaypointIndex + 1]
                            ? formatTime(etaList[passedWaypointIndex + 1][1])
                            : "--:--:--"
                        }}
                      </div>
                      <div class="text-subtitle2 text-grey-9">Must Arrive</div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>

              <!-- Navigation Controls -->
              <div class="row q-mt-md">
                <q-btn
                  class="col-1"
                  size="md"
                  color="secondary"
                  icon="mdi-minus"
                  @click="goToPreviousWaypoint"
                  :disable="passedWaypointIndex <= 0 || !isNavigating"
                />
                <q-btn
                  class="col-4 q-mr-md q-ml-md"
                  size="md"
                  :color="isNavigating ? 'negative' : 'primary'"
                  :label="isNavigating ? 'Stop Navigation' : 'Start Navigation'"
                  @click="toggleNavigation"
                />
                <q-btn
                  class="col-1"
                  size="md"
                  color="secondary"
                  icon="mdi-plus"
                  @click="skipWaypoint"
                  :disable="passedWaypointIndex >= routeCoordinates.length - 2 || !isNavigating"
                />
                <q-select
                  class="col-4 q-ml-md"
                  filled
                  v-model="startWaypointIndex"
                  :options="routeCoordinates.map((_, idx) => ({
                    label: `Waypoint ${idx + 1}`, value: idx
                  }))"
                  label="Start from Waypoint"
                  emit-value
                  map-options
                />
              </div>
            </div>
          </div>

          <!-- Throttle Slider -->
          <div class="col-2 q-pt-md q-pl-md flex flex-center">
            <ThrottleSlider
              v-model="throttleValue"
              :min="-1" :max="1" :step="0.01"
              readonly
              :show-label="true"
              class="q-mt-md"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Course Alert Bar -->
    <CourseSlider
      v-model="courseAlert"
      :min="-1" :max="1" :step="0.01"
      readonly
      :show-label="true"
      class="course-alert-bar"
    />
  </q-page>
</template>

<script setup>
import ThrottleSlider from 'src/components/ThrottleSlider.vue';
import CourseSlider from 'src/components/CourseSlider.vue';
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
    iconAnchor: [12, 18],  // <-- center anchor
  });
}

function createIndexedDotIcon(index) {
  return L.divIcon({
    html: `
      <div style="
        background-color: red;
        color: black;
        font-weight: bold;
        font-size: 12px;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        line-height: 24px;
        text-align: center;
        border: 2px solid white;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
      ">
        ${index + 1}
      </div>
    `,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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

function skipWaypoint() {
  if (
    passedWaypointIndex.value < routeCoordinates.value.length - 2 &&
    isNavigating.value
  ) {
    passedWaypointIndex.value++;
    $q.notify({ type: 'info', message: `Skipped to waypoint ${passedWaypointIndex.value + 2}`, position: 'top' });
    CF.addLog({
      type: 'info',
      message: `Skipped waypoint ${passedWaypointIndex.value + 1}`
    });
  }
  else {
    $q.notify({ type: 'negative', message: 'Already at final waypoint', position: 'top' });
  }
}

function goToPreviousWaypoint() {
  if (passedWaypointIndex.value > 0 && isNavigating.value) {
    passedWaypointIndex.value--;
    $q.notify({ type: 'info', message: `Returned to waypoint ${passedWaypointIndex.value + 2}`, position: 'top' });
  }
  else {
    $q.notify({ type: 'negative', message: 'Already at first waypoint', position: 'top' });
  }
}

const isFinishSegment = computed(() => {
  // true when the next leg is the final one
  return (
    isNavigating.value &&
    passedWaypointIndex.value === routeCoordinates.value.length - 2
  );
});

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
  const isFirst = index === 0;
  const isFinish = index === routeCoordinates.value.length - 1;

  if (isFirst || isFinish) {
    // green start/end icon
    return createIndexedStartEndIcon(index, isFinish);
  } else {
    // red numbered dot
    return createIndexedDotIcon(index);
  }
}

function parseTimeString(str) {
  return str.split(':').map(Number).concat(0);
}

function loadSavedSpeeds(length, fallbackSpeed) {
  const saved = JSON.parse(localStorage.getItem("speeds") || "[]");
  return Array.from({ length }, (_, i) => saved[i] ?? fallbackSpeed);
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
const finishCutLine = ref([]);
let targetSpeed  = ref(0);
const targetCourse = ref(0);
const courseAlert  = ref(0);
const speedWarning = ref(false);
const lastTargetSpeed = ref(null);

const delayColor = computed(() => {
  const seconds = estimatedDelay.value?.[1];
  if (seconds == null) return '';

  const absSec = Math.abs(seconds);

  if (absSec <= 3) {
    // On time (±3 seconds)
    return 'text-positive'; // green
  }

  if (seconds < 0) {
    // Early delays (negative seconds)
    if (absSec <= 5) return 'text-warning';  // mild early - orange
    if (absSec <= 10) return 'text-orange';  // more early - darker orange
    return 'text-negative';                   // very early - red
  } else {
    // Late delays (positive seconds)
    if (absSec <= 5) return 'text-warning';
    if (absSec <= 10) return 'text-orange';
    return 'text-negative';
  }
});

watchEffect(() => {
  targetSpeed.value = CF.get_target_speed();
});

watch(isNavigating, (val) => {
  localStorage.setItem('isNavigating', val);
});

watch(
  [
    () => estimatedDelay.value,
    () => currentBoatPos.value,
    () => passedWaypointIndex.value
  ],
  ([newDelay]) => {
    // Handle estimatedDelay update
    if (newDelay?.length) {
      throttleValue.value = newDelay[4];
    }

    // Handle boat position and waypoint updates
    if (
      isNavigating.value &&
      currentBoatPos.value &&
      routeCoordinates.value.length > passedWaypointIndex.value + 1
    ) {
      const nextWP = routeCoordinates.value[passedWaypointIndex.value + 1];
      targetCourse.value = CF.calculate_bearing(currentBoatPos.value, nextWP);
      courseAlert.value = CF.get_course_alert(currentCourse.value, targetCourse.value) * -1;
      targetSpeed = CF.get_target_speed(passedWaypointIndex.value);
    } else {
      targetCourse.value = 0;
      courseAlert.value = 0;
    }
  },
  { immediate: true }
);

watch(passedWaypointIndex, (newIndex) => {
  const newSpeed = CF.get_target_speed(newIndex);

  if (lastTargetSpeed.value !== null && newSpeed !== lastTargetSpeed.value) {
    speedWarning.value = true;
    $q.notify({
      type: 'warning',
      message: `Target speed changed to ${newSpeed.toFixed(1)} knots`,
      position: 'top',
    });

    setTimeout(() => {
      speedWarning.value = false;
    }, 2000);
  }

  lastTargetSpeed.value = newSpeed;
});

// 1. Initialize from localStorage (fallback to 0)
const raw = localStorage.getItem('startWaypointIndex');
const initialStart = raw !== null
  ? Number(raw)
  : 0;
const startWaypointIndex = ref(initialStart);

// 2. Watch it and persist on every change
watch(startWaypointIndex, (newIdx) => {
  // ensure it’s a valid integer
  const i = Number(newIdx);
  if (!Number.isNaN(i)) {
    localStorage.setItem('startWaypointIndex', String(i));
  }
});

watch(passedWaypointIndex, (val) => {
  localStorage.setItem('passedWaypointIndex', String(val));
});

window.addEventListener("keydown", async (event) => {
  if (event.key === "e" || event.key === "E") {
    const coords = await CF.getLiveData('coordinates'); // Await the GPS fetch
    if (!coords) {
      $q.notify({
        type: 'negative',
        message: 'No GPS position available',
        position: 'top'
      });
      return;
    }
    const pos = CF.formatCoordinates(coords); // Format is synchronous
    $q.notify({
        type: 'positive',
        message: 'Transit line logged',
        position: 'top'
      });
    CF.addLog({
      type: 'info',
      message: `Transit line at ${pos}`
    });
  }
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
  CF.addLog({
    type: 'info',
    message: `Navigation started from waypoint ${passedWaypointIndex.value + 1}`
  });

  const delayMs = Number(localStorage.getItem('updateFrequency') || 1) * 1000;

  let wasDotPositive = false;        // ← added for hysteresis logic
  const epsilon = 1e-3;              // ← deadband threshold

  navigationInterval = setInterval(async () => {
    try {
      const pos = await CF.getLiveData('coordinates');
      if (!pos) return;

      // ── Update boat state ─────────────────────────────────────────
      center.value = pos;
      zoom.value = 15;
      currentSpeed.value = (await CF.getLiveData('speed')) || 0;
      currentCourse.value = (await CF.getLiveData('course')) || 0;
      boatIcon.value = createBoatIcon(currentCourse.value);
      currentBoatPos.value = pos;
      prevPos = pos;
      prevTime = Date.now() / 1000;

      crossing_extension = Number(localStorage.getItem('crossing_extension'));

      const i = passedWaypointIndex.value;

      // ── Normal segment crossing ──────────────────────────────────
      if (routeCoordinates.value.length > i + 2 && !waypointSwitching.value) {
        const p1 = routeCoordinates.value[i];
        const p2 = routeCoordinates.value[i + 1];
        const p3 = routeCoordinates.value[i + 2];

        const { dot, cutLine } = await CF.check_crossing_status(p1, p2, p3, crossing_extension);
        lastDotProduct.value = dot;
        waypointCutLine.value = cutLine || [];

        if (dot > epsilon && !wasDotPositive) {
          waypointSwitching.value = true;
          setTimeout(() => {
            passedWaypointIndex.value++;
            CF.addLog({
              type: 'info',
              message: `Crossed waypoint ${i + 2}`
            });
            waypointSwitching.value = false;
          }, 100);
        }

        if (dot < -epsilon && wasDotPositive) {
          wasDotPositive = false;
        }

        if (dot > epsilon) {
          wasDotPositive = true;
        }
      }

      // ── FINAL segment: check finish line crossing ────────────────
      else if (routeCoordinates.value.length === i + 2 && !waypointSwitching.value) {
        const p1 = routeCoordinates.value[i];
        const p2 = routeCoordinates.value[i + 1];

        const { dot, finishLine } = await CF.check_finish_status(p1, p2, crossing_extension);
        finishCutLine.value = finishLine || [];

        if (dot > epsilon) {
          stopNavigation();
          setNavigationState(false);
          $q.notify({ type: 'positive', message: '🎉 Finish line crossed!', position: 'top' });
          CF.addLog({ type: 'info', message: `Finish line crossed!` });
        }
      }

      const nextIdx = passedWaypointIndex.value + 1;
      if (
        etaList.value.length > nextIdx &&
        plannedStartTime.value &&
        !isNaN(currentSpeed.value)
      ) {
        estimatedDelay.value = await CF.get_estimated_delay(
          etaList.value,
          nextIdx,
          currentSpeed.value
        );
      } else {
        estimatedDelay.value = null;
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
  if (
    startWaypointIndex.value < 0 ||
    startWaypointIndex.value >= routeCoordinates.value.length - 1
  ) {
    return $q.notify({ type: 'negative', message: 'Invalid start waypoint', position: 'top' });
  }

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

  const speeds = loadSavedSpeeds(routeCoordinates.value.length - 1, Number(plannedSpeed));
  etaList.value = await CF.get_eta_for_waypoints(plannedStartTime.value, speeds);

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
    passedWaypointIndex.value = startWaypointIndex.value;

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

  await nextTick();

  if (isNavigating.value) {
    const storedIndex = localStorage.getItem('passedWaypointIndex');
    passedWaypointIndex.value = storedIndex !== null ? Number(storedIndex) : startWaypointIndex.value;

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
  else {
    passedWaypointIndex.value = startWaypointIndex.value;
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
.course-alert-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 36px;
  z-index: 999;
}
</style>
