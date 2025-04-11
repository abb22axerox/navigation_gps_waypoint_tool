<template>
    <q-page class="q-pa-md">
        <div class="text-h4">Settings</div>
        <div class="q-pa-md">
            <div class="text-h6">Load Route:</div>
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

            <q-banner v-if="error" class="bg-red-1 text-red q-mt-md">
                {{ error }}
            </q-banner>
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

// Check for existing file on component mount
onMounted(() => {
    const savedFileName = localStorage.getItem('currentGPXFileName')
    if (savedFileName) {
        displayFileName.value = savedFileName
    }
})
</script>