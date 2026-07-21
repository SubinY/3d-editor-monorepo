<template>
  <div class="viewport-wrap" ref="wrapRef">
    <div class="viewport-canvas" ref="canvasRef" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useAssetEditor } from '../composables/useAssetEditor'

const canvasRef = ref<HTMLElement>()
const wrapRef = ref<HTMLElement>()
const editor = useAssetEditor()

function handlePointerDown(e: PointerEvent) {
  if (e.altKey) {
    editor.drillPick(e)
    return
  }
  editor.pick(e)
}

function handleDoubleClick(e: MouseEvent) {
  editor.drillPick(e as unknown as PointerEvent)
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const partId = e.dataTransfer?.getData('part-id')
  if (partId) editor.spawn(partId)
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && editor.drillActive.value) {
    editor.exitDrill()
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    editor.deleteSelection()
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    editor.undo()
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    editor.redo()
  }
  if (e.key.toLowerCase() === 'g' || e.key.toLowerCase() === 't') editor.setTool('translate')
  if (e.key.toLowerCase() === 'r') editor.setTool('rotate')
  if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) editor.setTool('scale')
  if (e.key === 'Escape') editor.select(null)
}

onMounted(async () => {
  if (canvasRef.value) {
    await editor.init(canvasRef.value)

    // 3D 上下文初始化完成后，若当前为 3D 模式，从 2D 排布数据构建 3D 场景并适配相机
    if (editor.mode.value === '3d') {
      await editor.buildLayoutScene()
      editor.fitCameraToScene()
    }

    const dom = editor.ctx.value?.renderer.domElement
    if (dom) {
      dom.addEventListener('pointerdown', handlePointerDown)
      dom.addEventListener('dblclick', handleDoubleClick)
      dom.addEventListener('dragover', handleDragOver)
      dom.addEventListener('drop', handleDrop)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  const dom = editor.ctx.value?.renderer.domElement
  if (dom) {
    dom.removeEventListener('pointerdown', handlePointerDown)
    dom.removeEventListener('dblclick', handleDoubleClick)
    dom.removeEventListener('dragover', handleDragOver)
    dom.removeEventListener('drop', handleDrop)
  }
  window.removeEventListener('keydown', handleKeyDown)
  editor.dispose()
})
</script>

<style scoped>
.viewport-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.viewport-canvas {
  width: 100%;
  height: 100%;
}
</style>
