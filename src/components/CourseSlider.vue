<template>
  <div class="horizontal-slider-container">
    <div class="slider-label left-label">Steer Left</div>

    <div class="custom-slider horizontal" @click="onClick($event)">
      <div class="custom-slider-track"></div>
      <div class="center-line"></div>
      <div class="custom-slider-thumb" :style="{ left: thumbPosition }"></div>
    </div>

    <div class="slider-label right-label">Steer Right</div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: -1 },
  max: { type: Number, default: 1 },
  step: { type: Number, default: 0.01 },
  readonly: { type: Boolean, default: false },
  showLabel: { type: Boolean, default: true },
});
const emit = defineEmits(['update:modelValue']);

const range = computed(() => props.max - props.min);
const percent = computed(() => ((props.modelValue - props.min) / range.value) * 100);
const thumbPosition = computed(() => `${percent.value}%`);

function onClick(e) {
  if (props.readonly) return;
  const sliderRect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - sliderRect.left;
  let newPercent = (clickX / sliderRect.width) * 100;
  newPercent = Math.max(0, Math.min(100, newPercent));
  let newVal = props.min + (newPercent / 100) * range.value;
  newVal = Math.round(newVal / props.step) * props.step;
  emit('update:modelValue', newVal);
}
</script>

<style scoped>
.horizontal-slider-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 60px;
}

.custom-slider.horizontal {
  width: 70%;
  height: 30px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-slider-track {
  width: 100%;
  height: 30px;
  background: linear-gradient(
    to right,
    red 0%,
    orange 25%,
    green 45%,
    green 55%,
    orange 75%,
    red 100%
  );
  border-radius: 5px;
  position: absolute;
}

.custom-slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 60px;
  background: black;
  border-radius: 6px;
  border: 2px solid #fff;
  pointer-events: none;
  transition: left 0.3s ease;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%   { box-shadow: 0 0 4px rgba(0, 0, 0, 0.3); }
  50%  { box-shadow: 0 0 8px rgba(0, 0, 0, 0.5); }
  100% { box-shadow: 0 0 4px rgba(0, 0, 0, 0.3); }
}

.slider-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
  margin: 0 10px;
}

.center-line {
  position: absolute;
  left: 50%;
  top: 0;
  width: 5px;
  height: 100%;
  background-color: rgba(0, 0, 0, 1);
  transform: translateX(-50%);
  z-index: 2;
}

.left-label  { color: red; }
.right-label { color: green; }
</style>
