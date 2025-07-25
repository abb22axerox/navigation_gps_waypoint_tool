<template>
  <div class="vertical-slider-container">
    <div class="slider-label top-label">Late</div>
    <div class="custom-slider vertical" @click="onClick($event)">
      <div class="custom-slider-track"></div>
      <div class="custom-slider-thumb" :style="{ bottom: thumbPosition }"></div>
    </div>
    <div class="slider-label bottom-label">Early</div>

    <!-- Throttle indicators -->
    <div class="throttle-indicators">
      <div class="throttle-indicator up">Throttle Up</div>
      <div class="throttle-indicator down">Throttle Down</div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
  modelValue: {
    type: Number,
    required: true,
  },
  min: {
    type: Number,
    default: -1,
  },
  max: {
    type: Number,
    default: 1,
  },
  step: {
    type: Number,
    default: 0.01,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  showLabel: {
    type: Boolean,
    default: true,
  },
});
const emit = defineEmits(['update:modelValue']);

const range = computed(() => props.max - props.min);
const percent = computed(() => ((props.modelValue - props.min) / range.value) * 100);
const thumbPosition = computed(() => `${percent.value}%`);

function onClick(e) {
  if (props.readonly) return;
  const sliderRect = e.currentTarget.getBoundingClientRect();
  const clickPos = e.clientY - sliderRect.top;
  let newPercent = (1 - (clickPos / sliderRect.height)) * 100;
  if (newPercent < 0) newPercent = 0;
  if (newPercent > 100) newPercent = 100;
  let newVal = props.min + (newPercent / 100) * range.value;
  newVal = Math.round(newVal / props.step) * props.step;
  emit('update:modelValue', newVal);
}
</script>

<style scoped>
.vertical-slider-container {
  position: relative;
  height: 400px;
  width: 40px;
}

/* Using flexbox in the slider container to center children horizontally */
.custom-slider.vertical {
  width: 30px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.custom-slider-track {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to bottom,
    rgb(255, 0, 0) 0%,      /* Red (Late) */
    rgb(255, 165, 0) 25%,   /* Orange */
    rgb(76, 175, 80) 45%,   /* Green (On Time) */
    rgb(76, 175, 80) 55%,   /* Green (On Time) */
    rgb(255, 165, 0) 75%,   /* Orange */
    rgb(255, 0, 0) 100%     /* Red (Early) */
  );
  border-radius: 4px;
  position: absolute;
}

.custom-slider-thumb {
  position: absolute;
  /* Centered horizontally via flexbox of parent */
  left: 50%;
  transform: translate(-50%, 50%);
  width: 60px;
  height: 20px;
  background: black;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 2px solid #ffffff;
  pointer-events: none; /* Non-interactive indicator */
  transition: bottom 0.3s ease-out;
}

.custom-slider-thumb:hover {
  cursor: default;
}

@keyframes pulse {
  0% { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); }
  50% { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5); }
  100% { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); }
}

.custom-slider-thumb {
  animation: pulse 2s infinite;
}

/* Position labels as before */
.slider-label {
  position: absolute;
  font-size: 12px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
}

.top-label {
  top: -20px;
}

.bottom-label {
  bottom: -20px;
}

/* Reposition throttle indicators so they’re visible */
.throttle-indicators {
  position: absolute;
  left: 100%; /* Place to the right of the slider container */
  top: 0;
  margin-left: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.7);
}

.throttle-indicator {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  padding: 10px 0;
}

.throttle-indicator.up {
  color: rgb(76, 175, 80);
}

.throttle-indicator.down {
  color: rgb(255, 0, 0);
}
</style>
