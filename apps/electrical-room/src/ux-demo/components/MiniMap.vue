<script setup lang="ts">
export interface MiniMapNode {
  id: string
  name: string
  /** 世界坐标（文档原点在房间中心） */
  x: number
  z: number
  w: number
  d: number
  yawDeg: number
  color: string
}

const props = defineProps<{
  nodes: MiniMapNode[]
  selectedId: string | null
  bounds: { width: number; depth: number }
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

function styleFor(n: MiniMapNode) {
  const hw = props.bounds.width / 2
  const hd = props.bounds.depth / 2
  const left = ((n.x + hw) / props.bounds.width) * 100
  const top = ((n.z + hd) / props.bounds.depth) * 100
  const width = Math.max(5, (n.w / props.bounds.width) * 100)
  const height = Math.max(5, (n.d / props.bounds.depth) * 100)
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    background: n.color,
    transform: `translate(-50%, -50%) rotate(${n.yawDeg}deg)`
  }
}
</script>

<template>
  <div class="minimap">
    <div class="title">平面图</div>
    <div class="map">
      <button
        v-for="n in nodes"
        :key="n.id"
        type="button"
        class="dot"
        :class="{ on: n.id === selectedId }"
        :style="styleFor(n)"
        :title="n.name"
        @click.stop="emit('select', n.id)"
      />
      <div class="cone" title="相机朝向（示意）" />
    </div>
  </div>
</template>

<style scoped>
.minimap {
  position: absolute;
  right: 14px;
  bottom: 58px;
  width: 160px;
  background: rgba(10, 16, 26, 0.92);
  border: 1px solid #2a3c52;
  border-radius: 10px;
  padding: 8px;
  z-index: 12;
  pointer-events: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.title {
  font-size: 10px;
  color: #7b90a8;
  margin-bottom: 6px;
}
.map {
  position: relative;
  height: 110px;
  background:
    linear-gradient(#1a2738 1px, transparent 1px) 0 0 / 12px 12px,
    linear-gradient(90deg, #1a2738 1px, transparent 1px) 0 0 / 12px 12px,
    #0f1826;
  border-radius: 6px;
  overflow: hidden;
}
.dot {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 2px;
  padding: 0;
  cursor: pointer;
  min-width: 6px;
  min-height: 6px;
  z-index: 1;
}
.dot:hover {
  outline: 1px solid #7dd3fc;
}
.dot.on {
  outline: 2px solid #3dd6ff;
  z-index: 2;
  box-shadow: 0 0 8px rgba(61, 214, 255, 0.45);
}
.cone {
  position: absolute;
  right: 10%;
  bottom: 12%;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 16px solid rgba(61, 214, 255, 0.45);
  transform: rotate(-30deg);
  pointer-events: none;
  z-index: 0;
}
</style>
