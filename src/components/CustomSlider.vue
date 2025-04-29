<template>
  <div class="custom-slider" @click="onClick($event)">
    <div class="custom-slider-track"></div>
    <div class="custom-slider-thumb" :style="{ left: thumbPosition }"></div>
    <div class="custom-slider-label" v-if="showLabel" :style="{ left: thumbLabelPosition }">
      {{ modelValue.toFixed(2) }}
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
const thumbPosition = computed(() => percent.value + '%');
const thumbLabelPosition = computed(() => `calc(${percent.value}% - 20px)`);

function onClick(e) {
  if (props.readonly) return;
  const sliderRect = e.currentTarget.getBoundingClientRect();
  const clickPos = e.clientX - sliderRect.left;
  let newPercent = (clickPos / sliderRect.width) * 100;
  if (newPercent < 0) newPercent = 0;
  if (newPercent > 100) newPercent = 100;
  let newVal = props.min + (newPercent / 100) * range.value;
  newVal = Math.round(newVal / props.step) * props.step;
  emit('update:modelValue', newVal);
}
</script>

<style scoped>
.custom-slider {
  position: relative;
  height: 40px;
  cursor: pointer;
  user-select: none;
}

.custom-slider-track {
  width: 100%;
  height: 30px;
  background: linear-gradient(
    to right,
    rgb(255, 0, 0) 0%,      /* Red */
    rgb(255, 165, 0) 25%,   /* Yellow/Orange */
    rgb(76, 175, 80) 45%,   /* Green */
    rgb(76, 175, 80) 55%,   /* Green */
    rgb(255, 165, 0) 75%,   /* Yellow/Orange */
    rgb(255, 0, 0) 100%     /* Red */
  );
  border-radius: 4px;
  position: absolute;
  top: 16px;
}

.custom-slider-thumb {
  position: absolute;
  top: 4px;
  width: 8px;
  height: 32px;
  background: white;
  border: none;
  border-radius: 2px;
  transform: translateX(-50%);
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.custom-slider-thumb::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 1px;
}

.custom-slider-label {
  position: absolute;
  top: -24px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>