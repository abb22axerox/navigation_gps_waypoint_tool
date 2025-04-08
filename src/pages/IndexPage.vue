<template>
  <q-page class="">
    <ul>
      <li v-for="(item, index) in todos.eta" :key="index">
        {{ item }}
      </li>
    </ul>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "src/boot/axios";
// import { add } from "src/utils/calculator";
// let x = ref(0);
// console.log(add(1, 2));
// x.value = 1;
const todos = ref([]);

onMounted(() => {
  console.log("mounted");
  api.get("/api/eta").then((res) => {
    console.log(res);
    todos.value = res.data;
  });
});

let speed = ref(0);

// Utility functions
function getTime() {
  const now = new Date();
  return [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(), // Use milliseconds directly
  ];
}

function convertUnit(operation, value) {
  if (operation === "to-seconds") {
    // Convert [hour, minute, second, millisecond] to total seconds
    const seconds =
      value[0] * 3600 + // Hours to seconds
      value[1] * 60 + // Minutes to seconds
      value[2] + // Add seconds
      value[3] / 1000; // Milliseconds to seconds
    return seconds;
  } else if (operation === "format-seconds") {
    // Convert total seconds to [hour, minute, second, millisecond]
    const valueH = Math.floor(value / 3600) % 24; // Extract hours (mod 24 for 24-hour format)
    const remainingSeconds = value % 3600;
    const valueM = Math.floor(remainingSeconds / 60); // Extract minutes
    const valueS = Math.floor(remainingSeconds % 60); // Extract seconds
    const fraction = value - Math.floor(value); // Fractional part of seconds
    const valueMilli = Math.round(fraction * 1000); // Convert fraction to milliseconds

    return [valueH, valueM, valueS, valueMilli];
  } else {
    throw new Error("Invalid operation");
  }
}

setInterval(() => {
  aefaefaef;
}, 500);

// Example usage
console.log(getTime()); // Example: [14, 30, 45, 123]
console.log(convertUnit("to-seconds", [1, 30, 15, 500])); // Example: 5415.5 seconds
console.log(convertUnit("format-seconds", 5415.5)); // Example: [1, 30, 15, 500]
</script>
