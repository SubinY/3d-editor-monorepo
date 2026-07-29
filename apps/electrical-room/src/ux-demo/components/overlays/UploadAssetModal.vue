<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { MockAsset } from '../../mock-data'

const emit = defineEmits<{
  close: []
  submit: [asset: MockAsset]
}>()

const form = reactive({
  name: '',
  category: 'cabinets',
  w: 800,
  d: 600,
  h: 2200,
  fileName: ''
})
const dragging = ref(false)

function onFiles(files: FileList | null) {
  const f = files?.[0]
  if (!f) return
  form.fileName = f.name
  if (!form.name) form.name = f.name.replace(/\.[^.]+$/, '')
}

function submit() {
  if (!form.name) return
  emit('submit', {
    id: `upload-${Date.now()}`,
    name: form.name,
    category: form.category,
    sizeLabel: `${form.w}×${form.d}×${form.h}`,
    w: form.w / 1000,
    d: form.d / 1000,
    h: form.h / 1000,
    thumb: '#4b6a88',
    favorite: true,
    version: 'v1.0.0'
  })
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal">
      <header>
        <h3>上传资产</h3>
        <button type="button" @click="emit('close')">×</button>
      </header>
      <p class="hint">支持 glTF / GLB / FBX / OBJ / STEP / 贴图等（示意，不实际上传）</p>
      <div
        class="drop"
        :class="{ on: dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="dragging = false; onFiles($event.dataTransfer?.files ?? null)"
      >
        <strong>拖拽文件到此处或点击上传</strong>
        <input type="file" @change="onFiles(($event.target as HTMLInputElement).files)" />
        <span v-if="form.fileName">已选：{{ form.fileName }}</span>
      </div>
      <div class="formats">
        <span>cabinet_v2.glb</span>
        <span>door_apart.gltf</span>
        <span>breaker.step</span>
        <span>panel_diffuse.png</span>
      </div>
      <div class="form">
        <label>名称<input v-model="form.name" placeholder="主配电柜" /></label>
        <label>
          分类
          <select v-model="form.category">
            <option value="cabinets">电柜</option>
            <option value="electrical">电气设备</option>
            <option value="devices">装置</option>
            <option value="doors">门窗</option>
          </select>
        </label>
        <div class="dims">
          <label>宽（毫米）<input v-model.number="form.w" type="number" /></label>
          <label>深（毫米）<input v-model.number="form.d" type="number" /></label>
          <label>高（毫米）<input v-model.number="form.h" type="number" /></label>
        </div>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('close')">取消</button>
        <button type="button" class="primary" @click="submit">上传并导入</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: min(520px, 92vw);
  background: #0f1826;
  border: 1px solid #2a3c52;
  border-radius: 14px;
  padding: 16px 18px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
header h3 {
  margin: 0;
}
header button {
  border: 0;
  background: transparent;
  color: #8ea4bd;
  font-size: 22px;
  cursor: pointer;
}
.hint {
  color: #6d8199;
  font-size: 12px;
}
.drop {
  position: relative;
  border: 1px dashed #3b5bdb;
  border-radius: 12px;
  padding: 28px;
  text-align: center;
  background: rgba(31, 111, 255, 0.06);
  color: #9ec1ff;
}
.drop.on {
  background: rgba(31, 111, 255, 0.14);
}
.drop input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.formats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.formats span {
  font-size: 11px;
  background: #152033;
  border-radius: 6px;
  padding: 4px 8px;
  color: #8ea4bd;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #7b90a8;
}
input,
select {
  background: #121c2a;
  border: 1px solid #223247;
  border-radius: 7px;
  color: #d7e4f2;
  padding: 7px 8px;
}
.dims {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.ghost,
.primary {
  border: 0;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
}
.ghost {
  background: #152033;
  color: #c5d4e6;
}
.primary {
  background: #1f6fff;
  color: #fff;
}
</style>
