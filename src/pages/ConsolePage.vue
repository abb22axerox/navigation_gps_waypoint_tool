<template>
    <q-page class="q-pa-md">
        <!-- Enhanced Header -->
        <div class="page-header q-mb-lg">
            <div class="row items-center justify-between">
                <div class="row items-center">
                    <q-icon name="terminal" size="2.5rem" color="primary" class="q-mr-md"/>
                    <div>
                        <div class="text-h4 text-weight-medium q-mb-xs">Console</div>
                        <div class="text-subtitle1 text-grey-7">Monitor navigation system status and logs</div>
                    </div>
                </div>
                <q-btn 
                    flat 
                    color="grey-7" 
                    icon="delete" 
                    label="Clear History"
                    @click="clearHistory"
                />
            </div>
            <q-separator class="q-mt-md" color="grey-4"/>
        </div>

        <div class="row q-col-gutter-md">
            <!-- Console Output Card -->
            <div class="col-12">
                <q-card class="console-card" bordered>
                    <q-card-section>
                        <div class="text-h6 q-mb-md">System Log</div>
                        <div class="console-output bg-grey-1">
                            <div v-for="(log, index) in logMessages" :key="index" 
                                 :class="['log-entry', `text-${log.type}`]">
                                <span class="timestamp">{{ log.timestamp }}</span>
                                <span class="message">{{ log.message }}</span>
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
    // Create new log entry
    const newLog = { timestamp, type, message }
    
    // Get current logs from localStorage
    const currentLogs = JSON.parse(localStorage.getItem('consoleLogs') || '[]')
    
    // Add new log
    const updatedLogs = [...currentLogs, newLog]
    
    // Keep only last 100 messages
    const trimmedLogs = updatedLogs.slice(-100)
    
    // Update both state and localStorage
    logMessages.value = trimmedLogs
    localStorage.setItem('consoleLogs', JSON.stringify(trimmedLogs))
}

function clearHistory() {
    localStorage.removeItem('consoleLogs')
    logMessages.value = []
    addLog({ type: 'info', message: 'Console history cleared' })
}

// Watch for navigation state changes with immediate effect
watch(() => localStorage.getItem('isNavigating'), (newValue, oldValue) => {
    if (newValue !== null && newValue !== oldValue) {
        const message = newValue === 'true' ? 'Navigation started' : 'Navigation stopped'
        const type = newValue === 'true' ? 'positive' : 'warning'
        addLog({ type, message })
    }
}, { immediate: true })

// Watch for GPX file changes with immediate effect
watch(() => localStorage.getItem('currentGPXFileName'), (newValue, oldValue) => {
    if (newValue && newValue !== oldValue) {
        addLog({ type: 'info', message: `Loaded route file: ${newValue}` })
    }
}, { immediate: true })

// Watch for planned speed changes with immediate effect
watch(() => localStorage.getItem('plannedSpeed'), (newValue, oldValue) => {
    if (newValue && newValue !== oldValue) {
        addLog({ type: 'info', message: `Updated planned speed to ${newValue} knots` })
    }
}, { immediate: true })

onMounted(() => {
    // Load existing logs from localStorage
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

.console-card {
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
}

.console-card:hover {
    box-shadow: 0 3px 8px rgba(0,0,0,0.15);
}

.console-output {
    padding: 1rem;
    border-radius: 4px;
    font-family: monospace;
    min-height: 300px;
}

.log-entry {
    padding: 4px 0;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    font-size: 0.9em;
}

.timestamp {
    color: #666;
    margin-right: 12px;
}

.text-info {
    color: #1976D2;
}

.text-positive {
    color: #21BA45;
}

.text-warning {
    color: #F2C037;
}

.text-negative {
    color: #C10015;
}
</style>
