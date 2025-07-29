<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="page-header q-mb-lg">
      <div class="row items-center">
        <q-icon name="map" size="2.5rem" color="primary" class="q-mr-md" />
        <div>
          <div class="text-h4 text-weight-medium q-mb-xs">Route Information</div>
          <div class="text-subtitle1 text-grey-7">
            View route details and waypoint information
          </div>
        </div>
      </div>
      <q-separator class="q-mt-md" color="grey-4" />
    </div>

    <div class="row q-col-gutter-md">
      <!-- Left Column -->
      <div class="col-12 col-sm-4">
        <!-- Mini Map -->
        <q-card flat bordered class="q-mb-md shadow-2 rounded">
          <q-card-section>
            <div style="height: 200px; width: 100%; border-radius: 8px; overflow: hidden;">
              <l-map
                v-if="waypoints.length"
                :zoom="zoom"
                :center="mapCenter"
                style="height: 100%; width: 100%;"
                :options="{ zoomControl: false, attributionControl: false }"
              >
                <l-tile-layer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                <l-polyline :lat-lngs="waypointCoordinates" color="blue" />

                <l-marker
                  v-for="(point, index) in waypointCoordinates"
                  :key="index"
                  :lat-lng="point"
                  :icon="getWaypointIcon(index)"
                />
              </l-map>
            </div>
          </q-card-section>
        </q-card>

        <!-- Status & Details Cards (unchanged) -->
        <q-card flat bordered class="q-pa-md q-mb-md shadow-2 rounded">
          <q-card-section>
            <div class="text-h6 q-mb-md">Status</div>
            <q-banner
              :class="isNavigating ? 'bg-green-1 text-green' : 'bg-orange-1 text-orange'"
              rounded
              class="q-mb-sm"
            >
              <template v-slot:avatar>
                <q-icon :name="isNavigating ? 'navigation' : 'close'" />
              </template>
              {{ isNavigating ? "Navigating" : "Not Navigating" }}
            </q-banner>
            <q-banner
              :class="sensorStatus ? 'bg-green-1 text-green' : 'bg-red-1 text-red'"
              rounded
            >
              <template v-slot:avatar>
                <q-icon :name="sensorStatus ? 'gps_fixed' : 'gps_off'" />
              </template>
              <div class="column">
                {{ sensorStatus ? "Connected to " + deviceID : "Phone GPS Not Connected" }}
              </div>
            </q-banner>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-pa-md q-mb-md shadow-2 rounded">
          <q-card-section>
            <div class="text-h6 q-mb-md">Route Details</div>
            <div class="q-gutter-sm">
              <div class="row items-center">
                <q-icon name="straight" class="q-mr-sm" color="primary" />
                <span class="text-weight-medium">Total Distance:</span>
                <span class="q-ml-sm">{{ totalDistance }} nm</span>
              </div>
              <div class="row items-center q-mt-sm">
                <q-icon name="speed" class="q-mr-sm" color="primary" />
                <span class="text-weight-medium">Planned Speed:</span>
                <span class="q-ml-sm">{{ plannedSpeed }} knots</span>
              </div>
              <div class="row items-center q-mt-sm">
                <q-icon name="schedule" class="q-mr-sm" color="primary" />
                <span class="text-weight-medium">Start Time:</span>
                <span class="q-ml-sm">{{ startTime }}</span>
              </div>
              <div class="row items-center q-mt-sm">
                <q-icon name="schedule" class="q-mr-sm" color="primary" />
                <span class="text-weight-medium">End Time:</span>
                <span class="q-ml-sm">{{ endTime }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Waypoints Table (unchanged) -->
      <div class="col-12 col-sm-8">
        <q-card flat bordered class="q-pa-md shadow-2 rounded">
          <q-card-section>
            <div class="text-h6 q-mb-md">Waypoints</div>
            <q-markup-table separator="cell" flat bordered class="bg-white rounded">
              <thead>
                <tr class="text-left bg-blue-1 text-black">
                  <th>Waypoint</th>
                  <th>Coordinate</th>
                  <th>Estimated Time of Arrival</th>
                  <th colspan="2">Speed (kn)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in waypoints" :key="index">
                  <td class="text-left text-weight-medium">{{ index + 1 }}</td>
                  <td class="text-left">{{ CF.formatCoordinates(item.coord) }}</td>
                  <td class="text-left text-primary">
                    {{ item.eta ? formatTimeArray(item.eta) : '—' }}
                  </td>
                  <td
                    v-if="index < waypoints.length - 1"
                    :rowspan="2"
                    class="bg-grey-2 text-center"
                    style="vertical-align: middle;"
                  >
                    <q-input
                      v-model.number="segmentSpeeds[index]"
                      type="number"
                      dense
                      filled
                      class="q-ma-xs"
                      style="width: 70px;"
                      @update:model-value="val => updateSpeed(index, val)"
                    />
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch, computed } from "vue";
import * as CF from "src/utils/calculation_functions";
import {
  LMap,
  LTileLayer,
  LMarker,
  LPolyline,
} from "@vue-leaflet/vue-leaflet";
import L from "leaflet";

const waypoints = ref([]);
const segmentSpeeds = ref([]);
const isNavigating = ref(localStorage.getItem("isNavigating") === "true");
const plannedSpeed = ref(0);
const totalDistance = ref(0);
const startTime = ref("--:--:--");
const endTime = ref("--:--:--");
const sensorStatus = ref(CF.isLiveDataFresh());
const deviceID = ref("Unknown Device");
const zoom = ref(12);
const mapCenter = ref([0, 0]); // initial default

const waypointCoordinates = computed(() =>
  waypoints.value.map((wp) => wp.coord)
);

function formatTimeArray(timeArray) {
  if (!Array.isArray(timeArray)) return timeArray;
  const [hours, minutes, seconds] = timeArray;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTimeString(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  return [hours, minutes, seconds, 0];
}

function updateSpeed(index, newSpeed) {
  segmentSpeeds.value[index] = newSpeed;
  localStorage.setItem("speeds", JSON.stringify(segmentSpeeds.value));
  calculateRouteDetails();
}

async function calculateRouteDetails() {
  try {
    const coordinates = await CF.get_route_coordinates();
    if (coordinates && coordinates.length) {
      totalDistance.value = CF.get_total_route_distance(coordinates).toFixed(5);

      const plannedSpeedValue = localStorage.getItem("plannedSpeed");
      plannedSpeed.value = plannedSpeedValue || 0;

      const savedTime = localStorage.getItem("plannedTime");
      const useCurrentTime = localStorage.getItem("useCurrentTime") === "true";
      const startTimeArray = useCurrentTime ? CF.get_time() : parseTimeString(savedTime);

      startTime.value = formatTimeArray(startTimeArray);

      segmentSpeeds.value = CF.getSpeedsWithFallback(Number(plannedSpeedValue), coordinates.length - 1);

      const eta = await CF.get_eta_for_waypoints(startTimeArray, segmentSpeeds.value);

      if (eta.length) {
        endTime.value = formatTimeArray(eta[eta.length - 1][1]);
      }

      waypoints.value = coordinates.map((coord, index) => {
        return {
          coord,
          eta: eta?.[index]?.[1] || null,
        };
      });
    }
  } catch (error) {
    console.error("Error calculating route details:", error);
  }
}

function getWaypointIcon(index) {
  return L.divIcon({
    className: "",
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
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

setInterval(async () => {
  sensorStatus.value = CF.isLiveDataFresh();
  deviceID.value = (await CF.getLiveData("device_id")) || "Unknown Device";
}, 100);

watch(() => localStorage.getItem("isNavigating"), (newValue) => {
  isNavigating.value = newValue === "true";
});

watch(waypointCoordinates, (coords) => {
  if (coords.length > 0) {
    mapCenter.value = CF.calculateRouteMidpoint(coords);
  }
});

onMounted(() => {
  isNavigating.value = localStorage.getItem("isNavigating") === "true";
  calculateRouteDetails();
});
</script>
