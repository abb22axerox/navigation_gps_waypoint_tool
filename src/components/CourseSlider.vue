<template>
  <div class="horizontal-slider-container q-mb-lg">
    <div class="slider-label q-mr-md">Steer Right</div>

    <div class="custom-slider horizontal" @click="onClick($event)">
      <div class="custom-slider-track"></div>
      <div class="center-line"></div>
      <div class="custom-slider-thumb" :style="{ left: thumbPosition }"></div>
    </div>

    <div class="slider-label q-ml-sm">Steer Left</div>
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

// INVERTED: Higher value = left side
const percent = computed(() => (1 - (props.modelValue - props.min) / range.value) * 100);
const thumbPosition = computed(() => `${percent.value}%`);

function onClick(e) {
  if (props.readonly) return;

  const sliderRect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - sliderRect.left;

  // INVERTED: Clicking further right gives lower values
  let newPercent = 1 - (clickX / sliderRect.width);
  newPercent = Math.max(0, Math.min(1, newPercent));

  let newVal = props.min + newPercent * range.value;
  newVal = Math.round(newVal / props.step) * props.step;

  emit('update:modelValue', newVal);
}
</script>
