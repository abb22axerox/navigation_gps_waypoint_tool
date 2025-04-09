<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>
          GPS Waypoint Navigation
        </q-toolbar-title>

        <div>
          <q-btn flat label="Dashboard" to="/" />
          <q-btn flat label="Info" to="/info" />
          <q-btn flat label="Settings" to="/settings" />
          <q-btn flat label="Console" to="/console" />
        </div>

        <div class="q-ml-md">
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