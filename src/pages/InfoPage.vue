<template>
  <q-page class="q-pa-md">
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

    <!-- New Phone Connection Banner -->
    <q-banner
      v-if="gpsConnected"
      class="bg-green-2 text-green"
      rounded
      style="margin-bottom: 1rem"
    >
      Phone Connected
    </q-banner>
    <q-banner
      v-else
      class="bg-red-1 text-red"
      rounded
      style="margin-bottom: 1rem"
    >
      Phone Not Connected
    </q-banner>

    <div class="row q-col-gutter-md">
      <!-- Left Column -->
      <div class="col-12 col-sm-4">
        <!-- Navigation Status Card -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6 q-mb-md">Navigation Status</div>
            <q-banner
              :class="
                isNavigating
                  ? 'bg-green-1 text-green'
                  : 'bg-orange-1 text-orange'
              "
              rounded
            >
              <template v-slot:avatar>
                <q-icon :name="isNavigating ? 'navigation' : 'gps_off'" />
              </template>
              {{ isNavigating ? "Navigating" : "Not Navigating" }}
            </q-banner>
          </q-card-section>
        </q-card>

        <!-- Route Details Card -->
        <q-card class="details-card" bordered>
          <q-card-section>
            <div class="text-h6 q-mb-md">Route Details</div>
            <div class="route-details">
              <div class="detail-item">
                <q-icon name="straight" class="q-mr-sm" />
                <span class="text-weight-medium">Total Distance:</span>
                <span class="q-ml-sm">{{ totalDistance }} nm</span>
              </div>
              <div class="detail-item q-mt-md">
                <q-icon name="speed" class="q-mr-sm" />
                <span class="text-weight-medium">Planned Speed:</span>
                <span class="q-ml-sm">{{ plannedSpeed }} knots</span>
              </div>
              <div class="detail-item q-mt-md">
                <q-icon name="schedule" class="q-mr-sm" />
                <span class="text-weight-medium">Start Time:</span>
                <span class="q-ml-sm">{{ startTime }}</span>
              </div>
              <div class="detail-item q-mt-md">
                <q-icon name="schedule" class="q-mr-sm" />
                <span class="text-weight-medium">End Time:</span>
                <span class="q-ml-sm">{{ endTime }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Waypoints Table Card -->
      <div class="col-12 col-sm-8">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6 q-mb-md">Waypoints</div>
            <q-markup-table separator="cell" flat bordered>
              <thead>
                <tr>
                  <th class="text-left bg-blue-1">Waypoint</th>
                  <th class="text-left bg-blue-1">Coordinate</th>
                  <th class="text-left bg-blue-1">Estimated Time of Arrival</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in waypoints" :key="index">
                  <td class="text-left text-weight-medium">{{ index + 1 }}</td>
                  <td class="text-left">{{ CF.formatCoordinates(item[0]) }}</td>
                  <td class="text-left text-primary">
                    {{ formatTimeArray(item[1]) }}
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

const waypoints = ref([]);
const isNavigating = ref(false);
const plannedSpeed = ref(0);
const gpsConnected = ref(false);

// Computed properties for route details
const totalDistance = computed(() => {
  if (!waypoints.value.length) return "0.000";
  const coordinates = waypoints.value.map((wp) => wp[0]);
  return CF.get_total_route_distance(coordinates).toFixed(3);
});

const startTime = computed(() => {
  if (!waypoints.value.length) return "-";
  return formatTimeArray(waypoints.value[0][1]);
});

const endTime = computed(() => {
  if (!waypoints.value.length) return "-";
  return formatTimeArray(waypoints.value[waypoints.value.length - 1][1]);
});

// Watch for planned speed updates
watch(
  () => localStorage.getItem("plannedSpeed"),
  (newValue) => {
    plannedSpeed.value = newValue ? Number(newValue) : 0;
  },
  { immediate: true }
);

// Watch for navigation state changes
watch(
  () => localStorage.getItem("isNavigating"),
  (newValue) => {
    isNavigating.value = newValue === "true";
  },
  { immediate: true }
);

// Watch for ETA updates
watch(
  () => localStorage.getItem("waypointsETA"),
  (newValue) => {
    if (newValue) {
      waypoints.value = JSON.parse(newValue);
    }
  },
  { immediate: true }
);

function formatTimeArray(timeArray) {
  if (!Array.isArray(timeArray)) return timeArray;
  const [hours, minutes, seconds] = timeArray;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

// Check GPS connection on page mount
async function checkGPS() {
  try {
    const loc = await CF.get_gps_location();
    gpsConnected.value = !!loc;
  } catch (err) {
    gpsConnected.value = false;
  }
}

onMounted(() => {
  checkGPS();
});
</script>

<style scoped>
.page-header {
  background: linear-gradient(to right, rgba(25, 118, 210, 0.05), transparent);
  padding: 1.5rem;
  border-radius: 8px;
}

.status-card,
.waypoints-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.status-card:hover,
.waypoints-card:hover {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.status-banner {
  font-size: 1.1em;
}

.waypoints-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}

.waypoints-table th {
  padding: 16px;
  font-size: 0.95em;
  border-bottom: 2px solid rgba(0, 0, 0, 0.12);
}

.waypoints-table td {
  padding: 12px 16px;
  font-size: 0.95em;
}

.waypoints-table tr:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.details-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.details-card:hover {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.detail-item {
  display: flex;
  align-items: center;
  font-size: 1.1em;
}

.detail-item .q-icon {
  font-size: 1.2em;
  color: #1976d2;
}
</style>
