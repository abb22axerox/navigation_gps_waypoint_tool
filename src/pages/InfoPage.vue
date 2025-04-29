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

    <div class="row q-col-gutter-md">
      <!-- Left Column -->
      <div class="col-12 col-sm-4">
        <!-- Navigation & GPS2IP Status Card -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6 q-mb-md">Status</div>
            <!-- Existing Navigation Status -->
            <q-banner
              :class="
                isNavigating
                  ? 'bg-green-1 text-green'
                  : 'bg-orange-1 text-orange'
              "
              rounded
              class="q-mb-sm"
            >
              <template v-slot:avatar>
                <q-icon :name="isNavigating ? 'navigation' : 'gps_off'" />
              </template>
              {{ isNavigating ? "Navigating" : "Not Navigating" }}
            </q-banner>
            <!-- New GPS2IP Connection Status -->
            <q-banner
              :class="gpsConnected ? 'bg-green-1 text-green' : 'bg-red-1 text-red'"
              rounded
            >
              <template v-slot:avatar>
                <q-icon :name="gpsConnected ? 'wifi' : 'wifi_off'" />
              </template>
              <div class="column">
                {{ gpsConnected ? "GPS2IP Connected" : "GPS2IP Not Connected" }}
                <div v-if="gpsError" class="text-caption text-grey-8">
                  {{ gpsError }}
                </div>
              </div>
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
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import * as CF from "src/utils/calculation_functions";
import { gpsListener } from "src/boot/gps-listener";

const waypoints = ref([]);
const isNavigating = ref(false);
const plannedSpeed = ref(0);
const gpsConnected = ref(false);
const gpsError = ref(null);

// Add these new reactive references
const totalDistance = ref(0);
const startTime = ref("--:--:--");
const endTime = ref("--:--:--");

// Add this new function to calculate route details
async function calculateRouteDetails() {
  try {
    // Get route coordinates
    const coordinates = await CF.get_route_coordinates();
    if (coordinates && coordinates.length) {
      // Calculate total distance
      totalDistance.value = CF.get_total_route_distance(coordinates).toFixed(2);

      // Get planned speed and start time
      const plannedSpeedValue = localStorage.getItem("plannedSpeed");
      plannedSpeed.value = plannedSpeedValue || 0; // Update planned speed display
      const savedTime = localStorage.getItem("plannedTime");
      const useCurrentTime = localStorage.getItem("useCurrentTime") === "true";

      // Set start time
      if (useCurrentTime) {
        startTime.value = formatTimeArray(CF.get_time());
      } else if (savedTime) {
        startTime.value = savedTime;
      }

      // Calculate ETAs and update waypoints
      if (plannedSpeedValue && coordinates.length) {
        const eta = await CF.get_eta_for_waypoints(
          useCurrentTime ? CF.get_time() : parseTimeString(savedTime),
          Number(plannedSpeedValue)
        );
        if (eta.length) {
          // Update end time
          endTime.value = formatTimeArray(eta[eta.length - 1][1]);
          
          // Update waypoints table data
          waypoints.value = coordinates.map((coord, index) => {
            return [coord, eta[index][1]];
          });
        }
      }
    }
  } catch (error) {
    console.error("Error calculating route details:", error);
  }
}

function formatTimeArray(timeArray) {
  if (!Array.isArray(timeArray)) return timeArray;
  const [hours, minutes, seconds] = timeArray;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Setup real-time GPS connection monitoring
function setupGpsListener() {
  gpsListener.on('connected', () => {
    gpsConnected.value = true;
    gpsError.value = null;
  });
  
  gpsListener.on('location', () => {
    gpsConnected.value = true;
    gpsError.value = null;
  });
  
  gpsListener.on('error', (error) => {
    gpsConnected.value = false;
    gpsError.value = error.message === 'GPS data stream stopped'
      ? 'No GPS updates received'
      : error.message;
  });

  gpsListener.on('close', () => {
    gpsConnected.value = false;
    gpsError.value = 'Connection closed';
  });
}

async function checkGPS() {
  try {
    const loc = await CF.get_current_location();
    gpsConnected.value = !!loc;
  } catch (err) {
    gpsConnected.value = false;
  }
}

onMounted(async () => {
  setupGpsListener();
  checkGPS();
  await calculateRouteDetails(); // Add this line
});

onBeforeUnmount(() => {
  gpsListener.stop();
  gpsListener.removeAllListeners('connected');
  gpsListener.removeAllListeners('location');
  gpsListener.removeAllListeners('error');
  gpsListener.removeAllListeners('close');
});
</script>

<style scoped>
/* ...existing styles... */
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