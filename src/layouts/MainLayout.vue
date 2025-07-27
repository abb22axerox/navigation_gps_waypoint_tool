<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-blue-10 text-white">
      <q-toolbar class="row items-center justify-between">

        <!-- App Title -->
        <q-toolbar-title class="text-weight-bold">
          <q-icon name="navigation" size="24px" class="q-mr-sm" />
          ThrottleAlert
        </q-toolbar-title>

        <!-- Right Section: Tabs + Status -->
        <div class="row items-center q-gutter-md">

          <!-- Tabs (Desktop Only) -->
          <q-tabs inline-label class="desktop-only">
            <q-route-tab to="/" label="Dashboard" icon="dashboard" />
            <q-route-tab to="/info" label="Info" icon="map" />
            <q-route-tab to="/settings" label="Settings" icon="settings" />
            <q-route-tab to="/console" label="Console" icon="terminal" />
          </q-tabs>

          <!-- Mobile Menu -->
          <q-btn flat dense round icon="menu" aria-label="Menu" class="mobile-only">
            <q-menu>
              <q-list style="min-width: 100px">
                <q-item clickable v-close-popup to="/">
                  <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
                  <q-item-section>Dashboard</q-item-section>
                </q-item>
                <q-item clickable v-close-popup to="/info">
                  <q-item-section avatar><q-icon name="map" /></q-item-section>
                  <q-item-section>Info</q-item-section>
                </q-item>
                <q-item clickable v-close-popup to="/settings">
                  <q-item-section avatar><q-icon name="settings" /></q-item-section>
                  <q-item-section>Settings</q-item-section>
                </q-item>
                <q-item clickable v-close-popup to="/console">
                  <q-item-section avatar><q-icon name="terminal" /></q-item-section>
                  <q-item-section>Console</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>

          <!-- Status Indicators -->
          <div class="items-center">
            <div class="row q-gutter-sm q-pa-xs items-center">
              <!-- GPS -->
              <q-icon
                :name="gpsFresh ? 'gps_fixed' : 'gps_off'"
                :color="gpsFresh ? 'green' : 'red'"
                size="20px"
              />

              <!-- Battery Percentage and Icon, shown only if GPS connected -->
              <template v-if="gpsFresh">
                <div class="q-ml-md">{{ batteryLevelDisplay }}</div>
                <q-icon :name="batteryIcon" size="20px" class="q-mr-md" />
              </template>

              <!-- Time -->
              <q-icon name="schedule" size="18px" class="q-mr-xs" />
              <div>{{ formattedTime }}</div>
            </div>
          </div>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { isLiveDataFresh, get_time, getLiveData } from "src/utils/calculation_functions";

const batteryLevel = ref(null);
const gpsFresh = ref(isLiveDataFresh());
const time = ref(get_time());

// Update every second
setInterval(async () => {
  time.value = get_time();
  batteryLevel.value = await getLiveData("battery_level");
  gpsFresh.value = isLiveDataFresh();
}, 1000);

// Computed values
const batteryLevelDisplay = computed(() => {
  return batteryLevel.value !== null ? `${batteryLevel.value.toFixed(0)}%` : "--%";
});

const batteryIcon = computed(() => {
  const level = batteryLevel.value;
  if (level === null) return "battery_unknown";
  if (level >= 90) return "battery_full";
  if (level >= 70) return "battery_6_bar";
  if (level >= 50) return "battery_5_bar";
  if (level >= 30) return "battery_3_bar";
  if (level >= 10) return "battery_2_bar";
  return "battery_alert";
});

const formattedTime = computed(() => {
  if (!Array.isArray(time.value)) return "--:--:--";
  const [h, m, s] = time.value;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
});
</script>

<style lang="scss">
.mobile-only {
  display: none;
}

@media (max-width: 600px) {
  .mobile-only {
    display: block;
  }
  .desktop-only {
    display: none;
  }
}
</style>
