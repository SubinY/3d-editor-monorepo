<template>
  <div class="stage" ref="wrapRef">
    <div class="canvas" ref="canvasRef"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useEditor } from '../composables/useEditor'

const canvasRef = ref<HTMLElement>()
const wrapRef = ref<HTMLElement>()
const editor = useEditor()
const { floorSize, init } = editor

onMounted(() => {
  if (canvasRef.value) init(canvasRef.value)
})
</script>

<style scoped>
.stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.canvas {
  width: 100%;
  height: 100%;
}
</style>
