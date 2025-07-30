<template>
  <div class="vertical-slider-container">
    <div class="slider-label q-mb-sm">Early</div>

    <div class="custom-slider vertical" @click="onClick($event)">
      <div class="custom-slider-track"></div>
      <div class="center-line"></div>
      <div class="custom-slider-thumb" :style="{ top: thumbPosition }"></div>
    </div>

    <div class="slider-label q-mt-sm">Late</div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue';
import 'src/css/sliderStyles.css';

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

// No inversion: min = top 0%, max = bottom 100%
const percent = computed(() => ((props.modelValue - props.min) / range.value) * 100);
const thumbPosition = computed(() => `${percent.value}%`);

function onClick(e) {
  if (props.readonly) return;
  const sliderRect = e.currentTarget.getBoundingClientRect();
  const clickPos = e.clientY - sliderRect.top;
  let newPercent = clickPos / sliderRect.height; // top = 0%
  newPercent = Math.min(Math.max(newPercent, 0), 1);
  let newVal = props.min + newPercent * range.value;
  newVal = Math.round(newVal / props.step) * props.step;
  emit('update:modelValue', newVal);
}
</script>
