<script setup lang="ts">
import type { AlignMode, AlignReference, DistributeAxis } from '@mh/3d-editor'

defineProps<{ count: number }>()

const emit = defineEmits<{
  align: [mode: AlignMode, reference: AlignReference]
  distribute: [axis: DistributeAxis]
}>()

const alignModes: Array<{ mode: AlignMode; label: string }> = [
  { mode: 'left', label: '左' },
  { mode: 'right', label: '右' },
  { mode: 'top', label: '上' },
  { mode: 'bottom', label: '下' },
  { mode: 'centerX', label: '水平中' },
  { mode: 'centerY', label: '垂直中' }
]
</script>

<template>
  <div class="align-strip">
    <p>已选 {{ count }} 个模型</p>
    <p class="label">对齐(参照框)</p>
    <div class="row">
      <button
        v-for="item in alignModes"
        :key="'b' + item.mode"
        type="button"
        :disabled="count < 2"
        @click="emit('align', item.mode, 'bounds')"
      >
        {{ item.label }}
      </button>
      <button type="button" :disabled="count < 3" @click="emit('distribute', 'x')">水平分布</button>
      <button type="button" :disabled="count < 3" @click="emit('distribute', 'y')">垂直分布</button>
    </div>
    <p class="label">对齐(参照第一个选中节点)</p>
    <div class="row">
      <button
        v-for="item in alignModes"
        :key="'p' + item.mode"
        type="button"
        :disabled="count < 2"
        @click="emit('align', item.mode, 'primary')"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.align-strip {
  padding: 8px 10px 4px;
  color: #d5dde8;
  font-size: 12px;
}
.label {
  margin: 8px 0 4px;
  color: #8b97a8;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid #2a303b;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
