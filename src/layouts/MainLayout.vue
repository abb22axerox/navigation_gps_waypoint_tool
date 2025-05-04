<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-blue-10 text-white">
      <q-toolbar>
        <q-toolbar-title class="text-weight-bold">
          <q-icon name="navigation" size="24px" class="q-mr-sm" />
          GPS Waypoint Navigation Tool
        </q-toolbar-title>

        <q-space />

        <q-tabs inline-label class="desktop-only">
          <q-route-tab to="/" label="Dashboard" icon="dashboard" />
          <q-route-tab to="/info" label="Info" icon="map" />
          <q-route-tab to="/settings" label="Settings" icon="settings" />
          <q-route-tab to="/console" label="Console" icon="terminal" />
        </q-tabs>

        <!-- Mobile menu -->
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

        <div class="q-ml-md text-weight-medium">
          <q-icon name="schedule" size="18px" class="q-mr-xs" />
          {{ formattedTime }}
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue';
import * as CF from "src/utils/calculation_functions";

const time = ref(CF.get_time());

setInterval(() => {
  time.value = CF.get_time();
}, 1000);

const formattedTime = computed(() => {
  if (!Array.isArray(time.value)) return time.value;
  
  const [hours, minutes, seconds] = time.value;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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