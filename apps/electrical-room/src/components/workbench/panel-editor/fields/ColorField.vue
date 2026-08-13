<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  /** 透明占位时展示的默认色 */
  fallback?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
}>()

const fallback = props.fallback ?? '#0c1420'

function displayColor(): string {
  const v = props.modelValue
  if (!v || v === 'transparent') return fallback
  return v
}

function setColor(v: string) {
  emit('update:modelValue', v || fallback)
  emit('change')
}
</script>

<template>
  <div class="color-row">
    <el-color-picker :model-value="displayColor()" @change="v => setColor(v || fallback)" />
    <el-input :model-value="displayColor()" @change="v => setColor(String(v || fallback))" />
  </div>
</template>

<style scoped>
.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.color-row :deep(.el-input) {
  flex: 1;
  min-width: 0;
}
</style>
