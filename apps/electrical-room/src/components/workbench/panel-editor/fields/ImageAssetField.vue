<script setup lang="ts">
import { computed, ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'

const props = defineProps<{
  url?: string
  name?: string
}>()

const emit = defineEmits<{
  pick: [payload: { url: string; name: string }]
  clear: []
}>()

const fileRef = ref<HTMLInputElement | null>(null)

const label = computed(() => props.name || (props.url ? '已选图片' : '未选择'))

function openPicker() {
  fileRef.value?.click()
}

function onFile(file: File | null) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    emit('pick', { url: String(reader.result || ''), name: file.name })
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="asset-row">
    <button type="button" class="thumb-btn" @click="openPicker">
      <img v-if="url" class="thumb" :src="url" alt="" />
      <span v-else class="thumb empty">+</span>
    </button>
    <button type="button" class="name" :title="label" @click="openPicker">{{ label }}</button>
    <el-button
      v-if="url"
      type="danger"
      link
      :icon="Delete"
      title="清除"
      @click="emit('clear')"
    />
    <input
      ref="fileRef"
      class="hidden"
      type="file"
      accept="image/*"
      @change="onFile(($event.target as HTMLInputElement).files?.[0] ?? null)"
    />
  </div>
</template>

<style scoped>
.asset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.thumb-btn {
  width: 36px;
  height: 28px;
  padding: 0;
  border: 1px solid #2d3b4c;
  border-radius: 4px;
  background: #0f1720;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb.empty {
  display: grid;
  place-items: center;
  color: #8aa0b5;
  font-size: 14px;
}

.name {
  flex: 1;
  min-width: 0;
  height: 28px;
  border: 0;
  background: transparent;
  color: #e8eef5;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hidden {
  display: none;
}
</style>
