<template>
  <q-page class="bg-grey-1 q-pa-md">
    <!-- Enhanced Header -->
    <div class="page-header q-mb-lg">
      <div class="row items-center justify-between">
        <div class="row items-center">
          <q-icon name="terminal" size="2.5rem" color="primary" class="q-mr-md" />
          <div>
            <div class="text-h4 text-weight-medium q-mb-xs">Console</div>
            <div class="text-subtitle1 text-grey-7">
              Monitor system logs and navigation status
            </div>
          </div>
        </div>
        <q-btn flat color="grey-7" icon="delete" label="Clear History" @click="clearHistory" />
      </div>
      <q-separator class="q-mt-md" color="grey-4" />
    </div>

    <div class="row q-col-gutter-md">
      <!-- Console Output Card -->
      <div class="col-12">
        <q-card flat bordered class="q-pa-md shadow-2 rounded">
          <q-card-section>
            <div class="text-h6 q-mb-md">System Log</div>
            <div class="bg-white q-pa-sm rounded" style="min-height: 300px; font-family: monospace;">
              <div
                v-for="(log, index) in logMessages"
                :key="index"
                class="q-pa-xs border-bottom"
                :class="`text-${log.type}`"
              >
                <span class="text-caption text-grey-6 q-mr-sm">{{ log.timestamp }}</span>
                <span>{{ log.message }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const logMessages = ref([])

function addLog({ type, message }) {
  const timestamp = new Date().toLocaleTimeString()
  const newLog = { timestamp, type, message }
  const currentLogs = JSON.parse(localStorage.getItem('consoleLogs') || '[]')
  const updatedLogs = [...currentLogs, newLog]
  // Keep only the last 100 messages
  const trimmedLogs = updatedLogs.slice(-100)
  logMessages.value = trimmedLogs
  localStorage.setItem('consoleLogs', JSON.stringify(trimmedLogs))
}

function clearHistory() {
  localStorage.removeItem('consoleLogs')
  logMessages.value = []
  addLog({ type: 'info', message: 'Console history cleared' })
}

watch(
  () => localStorage.getItem('isNavigating'),
  (newValue, oldValue) => {
    if (newValue !== null && newValue !== oldValue) {
      const message = newValue === 'true' ? 'Navigation started' : 'Navigation stopped'
      const type = newValue === 'true' ? 'positive' : 'warning'
      addLog({ type, message })
    }
  },
  { immediate: true }
)

watch(
  () => localStorage.getItem('currentGPXFileName'),
  (newValue, oldValue) => {
    if (newValue && newValue !== oldValue) {
      addLog({ type: 'info', message: `Loaded route file: ${newValue}` })
    }
  },
  { immediate: true }
)

watch(
  () => localStorage.getItem('plannedSpeed'),
  (newValue, oldValue) => {
    if (newValue && newValue !== oldValue) {
      addLog({ type: 'info', message: `Updated planned speed to ${newValue} knots` })
    }
  },
  { immediate: true }
)

onMounted(() => {
  const savedLogs = localStorage.getItem('consoleLogs')
  if (savedLogs) {
    logMessages.value = JSON.parse(savedLogs)
  } else {
    addLog({ type: 'info', message: 'Navigation system initialized' })
  }
})
</script>

<style scoped>
.page-header {
  background: linear-gradient(to right, rgba(25, 118, 210, 0.05), transparent);
  padding: 1.5rem;
  border-radius: 8px;
}
.border-bottom {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}
</style>