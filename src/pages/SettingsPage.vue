<template>
  <q-page class="q-pa-md bg-grey-1">
    <!-- Enhanced Header -->
    <div class="q-mb-lg">
      <div class="row items-center">
        <q-icon name="settings" size="2.5rem" color="primary" class="q-mr-md" />
        <div>
          <div class="text-h4 text-weight-medium q-mb-xs">Settings</div>
          <div class="text-subtitle1 text-grey-7">
            Configure navigation parameters and route data
          </div>
        </div>
      </div>
      <q-separator class="q-mt-md" color="grey-4" />
    </div>

    <div class="row q-col-gutter-md">
      <!-- Parameters Card -->
      <div class="col-12 col-sm-6">
        <q-card flat bordered class="settings-card q-pa-md shadow-2 rounded">
          <q-card-section>
            <div class="text-h6 q-mb-md">Navigation Parameters</div>

            <!-- Speed Input -->
            <q-input
              class="q-mb-md"
              filled
              v-model.number="plannedSpeed"
              label="Planned Speed (Knots)"
              stack-label
              :dense="dense"
              type="number"
              @update:model-value="handleSpeedUpdate"
            >
              <template v-slot:append>
                <q-icon name="speed" color="primary" />
              </template>
            </q-input>

            <!-- Crossing Extension Input -->
            <q-input
              class="q-mb-md"
              filled
              v-model.number="crossingExtension"
              label="Crossing Extension (meters)"
              stack-label
              :dense="dense"
              type="number"
              @update:model-value="handleCrossingExtensionUpdate"
            >
              <template v-slot:append>
                <q-icon name="swap_horiz" color="primary" />
              </template>
            </q-input>

            <!-- Time Input -->
            <q-input
              class="q-mb-sm"
              filled
              v-model="plannedTime"
              label="Start Time (HH:MM:SS)"
              mask="fulltime"
              :rules="['fulltime']"
              :readonly="useCurrentTime"
              stack-label
              :dense="dense"
              @update:model-value="handleManualTimeUpdate"
            >
              <template v-slot:append>
                <q-icon name="access_time" color="primary" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-time
                      v-model="plannedTime"
                      with-seconds
                      format24h
                      :readonly="useCurrentTime"
                    >
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="Close" color="primary" flat />
                      </div>
                    </q-time>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>

            <q-toggle
              v-model="useCurrentTime"
              label="Use Current Time Instead"
              @update:model-value="handleCurrentTimeToggle"
              class="q-mb-md"
            />

            <!-- Update Frequency Input -->
            <q-input
              class="q-mb-md"
              filled
              v-model.number="updateFrequencyHz"
              label="Update Frequency (Hz)"
              stack-label
              :dense="dense"
              type="number"
              @update:model-value="handleUpdateFrequencyUpdate"
            >
              <template v-slot:append>
                <q-icon name="update" color="primary" />
              </template>
            </q-input>
          </q-card-section>
        </q-card>
      </div>

      <!-- SensorLog Settings Card -->
      <div class="col-12 col-sm-6">
        <q-card flat bordered class="settings-card q-pa-md shadow-2 rounded">
          <q-card-section>
            <div class="text-h6 q-mb-md">GPS Connection</div>
            <q-banner class="bg-blue-1 text-blue q-mt-md rounded" dense>
              <template v-slot:avatar>
                <q-icon name="info" color="blue" />
              </template>
              <div class="column">
                <div>To start the GPS bridge server:</div>
                <code class="q-mt-sm">
                  1. Open terminal<br />
                  2. Navigate to project root<br />
                  3. Run: node src/boot/sensorlog-server-tcp.js
                </code>
              </div>
            </q-banner>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="settings-card q-pa-md q-mt-md shadow-2 rounded">
          <q-card-section>
            <div class="text-h6 q-mb-md">Load Route</div>
            <q-file
              filled
              bottom-slots
              v-model="gpxFile"
              label="Upload GPX File"
              accept=".gpx"
              @update:model-value="handleFileUpload"
              counter
              :display-value="displayFileName"
            >
              <template v-slot:prepend>
                <q-icon name="upload_file" color="primary" @click.stop.prevent />
              </template>
              <template v-slot:append>
                <q-icon
                  name="close"
                  color="primary"
                  @click.stop.prevent="clearFile"
                  class="cursor-pointer"
                />
              </template>
              <template v-slot:hint>
                Select a GPX file to load route waypoints
              </template>
            </q-file>

            <q-banner v-if="error" class="bg-red-1 text-red q-mt-md rounded" dense>
              <template v-slot:avatar>
                <q-icon name="error" color="negative" />
              </template>
              {{ error }}
            </q-banner>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar } from "quasar";
import * as CF from "src/utils/calculation_functions";

const $q = useQuasar();

const gpxFile = ref(null);
const error = ref(null);
const displayFileName = ref("");
const plannedSpeed = ref(0);
const crossingExtension = ref(50); // default 50 meters
const dense = ref(true);
const plannedTime = ref("");
const useCurrentTime = ref(false);
const updateFrequencyHz = ref(1); // Default 1 Hz update

async function handleFileUpload() {
  if (!gpxFile.value) return;
  error.value = null;
  const file = gpxFile.value;
  if (!file.name.endsWith(".gpx")) {
    error.value = "Please select a GPX file";
    return;
  }
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      localStorage.setItem("currentGPXFile", content);
      localStorage.setItem("currentGPXFileName", file.name);
      displayFileName.value = file.name;

      // ✅ Reset speeds[] to match new route
      const route = await CF.get_route_coordinates(); // assumes content is already stored
      if (route && route.length > 1) {
        const speed = Number(localStorage.getItem("plannedSpeed") || 5);
        const newSpeeds = Array(route.length - 1).fill(speed);
        localStorage.setItem("speeds", JSON.stringify(newSpeeds));
      } else {
        localStorage.removeItem("speeds");
      }

      $q.notify({
        type: "positive",
        message: "GPX file uploaded successfully",
        position: "top",
        timeout: 2000,
      });
    };
    reader.onerror = () => {
      error.value = "Error reading file";
    };
    reader.readAsText(file);
  } catch (err) {
    error.value = `Error processing file: ${err.message}`;
    console.error("File processing error:", err);
  }
}

function clearFile() {
  gpxFile.value = null;
  displayFileName.value = "";
  localStorage.removeItem("currentGPXFile");
  localStorage.removeItem("currentGPXFileName");
  localStorage.removeItem("speeds"); // clear speed array
}

async function handleSpeedUpdate(value) {
  if (value <= 0) {
    $q.notify({
      type: "negative",
      message: "Planned speed must be greater than 0",
      position: "top",
      timeout: 2000,
    });
    return;
  }

  const route = await CF.get_route_coordinates();
  if (!route || route.length < 2) {
    $q.notify({
      type: "warning",
      message: "No route loaded. Speed will apply when route is set.",
      position: "top",
    });
    localStorage.setItem("plannedSpeed", value); // fallback
    return;
  }

  const segmentCount = route.length - 1;
  const speedsArray = Array(segmentCount).fill(value);
  localStorage.setItem("speeds", JSON.stringify(speedsArray));
  localStorage.setItem("plannedSpeed", value); // optional backup

  $q.notify({
    type: "positive",
    message: `Speed applied to all ${segmentCount} segments`,
    position: "top",
  });
}

function handleCrossingExtensionUpdate(value) {
  if (value <= 0) {
    $q.notify({
      type: "negative",
      message: "Crossing extension must be greater than 0",
      position: "top",
      timeout: 2000,
    });
    return;
  }
  localStorage.setItem("crossing_extension", value);
  $q.notify({
    type: "positive",
    message: "Crossing extension updated successfully",
    position: "top",
    timeout: 2000,
  });
}

function handleManualTimeUpdate(value) {
  useCurrentTime.value = false;
  localStorage.setItem("useCurrentTime", "false");
  localStorage.setItem("plannedTime", value);
  $q.notify({
    type: "positive",
    message: "Start time updated successfully",
    position: "top",
    timeout: 2000,
  });
}

function handleCurrentTimeToggle(value) {
  localStorage.setItem("useCurrentTime", String(value));
  if (value) {
    const currentTime = CF.get_time();
    plannedTime.value = currentTime
      .slice(0, 3)
      .map((v) => String(v).padStart(2, "0"))
      .join(":");
  }
}

function handleUpdateFrequencyUpdate(value) {
  if (value <= 0) {
    $q.notify({
      type: "negative",
      message: "Update frequency must be greater than 0 Hz",
      position: "top",
      timeout: 2000,
    });
    return;
  }
  const period = 1 / value;
  localStorage.setItem("updateFrequency", period.toString());
  $q.notify({
    type: "positive",
    message: "Update frequency updated successfully",
    position: "top",
    timeout: 2000,
  });
}

onMounted(async () => {
  const savedFileName = localStorage.getItem("currentGPXFileName");
  if (savedFileName) {
    displayFileName.value = savedFileName;
  }

  const savedSpeed = localStorage.getItem("plannedSpeed");
  if (savedSpeed) {
    plannedSpeed.value = Number(savedSpeed);
  }

  const savedCrossingExtension = localStorage.getItem("crossing_extension");
  if (savedCrossingExtension) {
    crossingExtension.value = Number(savedCrossingExtension);
  }

  const savedTime = localStorage.getItem("plannedTime");
  if (savedTime) {
    plannedTime.value = savedTime;
  } else {
    const currentTime = CF.get_time();
    plannedTime.value = currentTime
      .slice(0, 3)
      .map((v) => String(v).padStart(2, "0"))
      .join(":");
  }

  const savedUseCurrentTime = localStorage.getItem("useCurrentTime");
  if (savedUseCurrentTime !== null) {
    useCurrentTime.value = savedUseCurrentTime === "true";
    if (useCurrentTime.value) {
      const currentTime = CF.get_time();
      plannedTime.value = currentTime
        .slice(0, 3)
        .map((v) => String(v).padStart(2, "0"))
        .join(":");
    }
  }

  const savedUpdateFrequency = localStorage.getItem("updateFrequency");
  if (savedUpdateFrequency) {
    updateFrequencyHz.value = Number((1 / Number(savedUpdateFrequency)).toFixed(2));
  }

  // ✅ Ensure speed array matches route length
  const route = await CF.get_route_coordinates();
  if (route && route.length > 1) {
    const segments = route.length - 1;
    const savedSpeeds = JSON.parse(localStorage.getItem("speeds") || "[]");
    const planned = Number(localStorage.getItem("plannedSpeed") || 5);

    if (savedSpeeds.length !== segments) {
      const newSpeeds = Array(segments).fill(planned);
      localStorage.setItem("speeds", JSON.stringify(newSpeeds));
    }
  }
});
</script>

<style scoped>
.settings-card {
  background-color: white;
}
</style>
