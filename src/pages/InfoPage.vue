<template>
  <q-page class="q-pa-md bg-grey-1">
    <!-- Enhanced Header -->
    <div class="page-header q-mb-lg">
      <div class="row items-center">
        <q-icon name="map" size="2.5rem" color="primary" class="q-mr-md" />
        <div>
          <div class="text-h4 text-weight-medium q-mb-xs">
            Route Information
          </div>
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
        <!-- Navigation & GPS2IP Status Card -->
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

        <!-- Route Details Card -->
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

      <!-- Waypoints Table Card -->
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
                  <th>Speed (kn)</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in waypoints"
                  :key="index"
                >
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
                      v-model.number="waypoints[index].speed"
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
import { ref, onMounted, watch } from "vue";
import * as CF from "src/utils/calculation_functions";

const waypoints = ref([]);
const isNavigating = ref(localStorage.getItem("isNavigating") === "true");
const plannedSpeed = ref(0);
const totalDistance = ref(0);
const startTime = ref("--:--:--");
const endTime = ref("--:--:--");
const sensorStatus = ref(CF.isLiveDataFresh());
const deviceID = ref("Unknown Device");

setInterval(async () => {
  sensorStatus.value = CF.isLiveDataFresh();
  deviceID.value = (await CF.getLiveData('device_id')) || "Unknown Device";
}, 100);

function formatTimeArray(timeArray) {
  if (!Array.isArray(timeArray)) return timeArray;
  const [hours, minutes, seconds] = timeArray;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTimeString(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes, seconds] = timeStr.split(":" ).map(Number);
  return [hours, minutes, seconds, 0];
}

function updateSpeed(index, newSpeed) {
  waypoints.value[index].speed = newSpeed;
  localStorage.setItem(`speed_${index}`, newSpeed);
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
      if (useCurrentTime) {
        startTime.value = formatTimeArray(CF.get_time());
      } else if (savedTime) {
        startTime.value = savedTime;
      }

      const savedETA = localStorage.getItem("waypointsETA");
      let eta = [];

      if (isNavigating.value && savedETA) {
        eta = JSON.parse(savedETA);
        endTime.value = formatTimeArray(eta[eta.length - 1][1]);
      } else if (plannedSpeedValue && coordinates.length) {
        const startTimeArray = useCurrentTime ? CF.get_time() : parseTimeString(savedTime);
        eta = await CF.get_eta_for_waypoints(startTimeArray, Number(plannedSpeedValue));
        if (eta.length) {
          endTime.value = formatTimeArray(eta[eta.length - 1][1]);
        }
      }

      waypoints.value = coordinates.map((coord, index) => {
        return {
          coord,
          eta: eta?.[index]?.[1] || null,
          speed: index < coordinates.length - 1
            ? Number(localStorage.getItem(`speed_${index}`)) || Number(plannedSpeed.value)
            : null
        };
      });
    }
  } catch (error) {
    console.error("Error calculating route details:", error);
  }
}

watch(() => localStorage.getItem("isNavigating"), (newValue) => {
  isNavigating.value = newValue === "true";
});

onMounted(() => {
  isNavigating.value = localStorage.getItem("isNavigating") === "true";
  calculateRouteDetails();
});
</script>

<style scoped>
.page-header {
  background: linear-gradient(to right, rgba(25, 118, 210, 0.05), transparent);
  padding: 1.5rem;
  border-radius: 8px;
}
</style>
