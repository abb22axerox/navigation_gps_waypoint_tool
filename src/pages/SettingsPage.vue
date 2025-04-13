<template>
    <q-page class="q-pa-md">
        <!-- Enhanced Header -->
        <div class="page-header q-mb-lg">
            <div class="row items-center">
                <q-icon name="settings" size="2.5rem" color="primary" class="q-mr-md"/>
                <div>
                    <div class="text-h4 text-weight-medium q-mb-xs">Settings</div>
                    <div class="text-subtitle1 text-grey-7">Configure navigation parameters and route data</div>
                </div>
            </div>
            <q-separator class="q-mt-md" color="grey-4"/>
        </div>

        <div class="row q-col-gutter-md">
            <!-- Parameters Card -->
            <div class="col-12 col-sm-6">
                <q-card class="settings-card" bordered>
                    <q-card-section>
                        <div class="text-h6 q-mb-md">Navigation Parameters</div>
                        <q-input 
                            class="q-mb-md"
                            filled 
                            v-model.number="plannedSpeed" 
                            label="Planned Speed" 
                            stack-label 
                            :dense="dense"
                            type="number"
                            @update:model-value="handleSpeedUpdate"
                        >
                            <template v-slot:append>
                                <q-icon name="speed" />
                            </template>
                        </q-input>
                    </q-card-section>
                </q-card>
            </div>

            <!-- Route Upload Card -->
            <div class="col-12 col-sm-6">
                <q-card class="settings-card" bordered>
                    <q-card-section>
                        <div class="text-h6 q-mb-md">Route Configuration</div>
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
                                <q-icon name="upload_file" @click.stop.prevent />
                            </template>
                            <template v-slot:append>
                                <q-icon 
                                    name="close" 
                                    @click.stop.prevent="clearFile" 
                                    class="cursor-pointer" 
                                />
                            </template>
                            <template v-slot:hint>
                                Select a GPX file to load route waypoints
                            </template>
                        </q-file>

                        <q-banner v-if="error" class="bg-red-1 text-red q-mt-md" rounded>
                            <template v-slot:avatar>
                                <q-icon name="error" color="negative"/>
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
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const gpxFile = ref(null)
const error = ref(null)
const displayFileName = ref('')
const plannedSpeed = ref(0)
const dense = ref(true)

// Handle file upload
async function handleFileUpload() {
    if (!gpxFile.value) return

    error.value = null
    const file = gpxFile.value

    // Check file type
    if (!file.name.endsWith('.gpx')) {
        error.value = 'Please select a GPX file'
        return
    }

    try {
        // Read file content
        const reader = new FileReader()
        
        reader.onload = async (e) => {
            const content = e.target.result
            
            // Save file to local storage
            localStorage.setItem('currentGPXFile', content)
            localStorage.setItem('currentGPXFileName', file.name)
            displayFileName.value = file.name
            
            // Show success notification
            $q.notify({
                type: 'positive',
                message: 'GPX file uploaded successfully',
                position: 'top',
                timeout: 2000
            })
        }

        reader.onerror = () => {
            error.value = 'Error reading file'
        }

        // Start reading the file
        reader.readAsText(file)

    } catch (err) {
        error.value = `Error processing file: ${err.message}`
        console.error('File processing error:', err)
    }
}

function clearFile() {
    gpxFile.value = null
    displayFileName.value = ''
    localStorage.removeItem('currentGPXFile')
    localStorage.removeItem('currentGPXFileName')
}

// Handle planned speed updates
function handleSpeedUpdate(value) {
    if (value < 0) {
        $q.notify({
            type: 'negative',
            message: 'Planned speed cannot be negative',
            position: 'top',
            timeout: 2000
        })
        return
    }
    else if (value == 0) {
        $q.notify({
            type: 'negative',
            message: 'Planned speed cannot be zero',
            position: 'top',
            timeout: 2000
        })
        return
    }
    else {
        $q.notify({
                type: 'positive',
                message: 'Speed updated successfully',
                position: 'top',
                timeout: 2000
        })
        localStorage.setItem('plannedSpeed', value)
    }

}

// Modified onMounted to also load planned speed
onMounted(() => {
    const savedFileName = localStorage.getItem('currentGPXFileName')
    if (savedFileName) {
        displayFileName.value = savedFileName
    }
    
    const savedSpeed = localStorage.getItem('plannedSpeed')
    if (savedSpeed) {
        plannedSpeed.value = Number(savedSpeed)
    }
})
</script>

<style scoped>
.page-header {
    background: linear-gradient(to right, rgba(25, 118, 210, 0.05), transparent);
    padding: 1.5rem;
    border-radius: 8px;
}

.settings-card {
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
}

.settings-card:hover {
    box-shadow: 0 3px 8px rgba(0,0,0,0.15);
}
</style>