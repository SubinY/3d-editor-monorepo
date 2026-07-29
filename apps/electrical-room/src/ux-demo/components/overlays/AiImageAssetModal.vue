<script setup lang="ts">
import { ref } from 'vue'
import type { MockAsset } from '../../mock-data'

const emit = defineEmits<{
  close: []
  submit: [asset: MockAsset]
}>()

const stage = ref<'idle' | 'running' | 'done'>('idle')
const progress = ref(0)
const previewUrl = ref('')
let timer: number | undefined

const result = {
  name: '断路器 MCCB NSX160N',
  brand: 'Schneider',
  confidence: 92,
  w: 105,
  d: 86,
  h: 161
}

function onFile(files: FileList | null) {
  const f = files?.[0]
  if (!f) return
  previewUrl.value = URL.createObjectURL(f)
  stage.value = 'idle'
}

function recognize() {
  if (!previewUrl.value) return
  stage.value = 'running'
  progress.value = 0
  window.clearInterval(timer)
  timer = window.setInterval(() => {
    progress.value = Math.min(100, progress.value + 8 + Math.random() * 12)
    if (progress.value >= 100) {
      window.clearInterval(timer)
      stage.value = 'done'
    }
  }, 180)
}

function importAsset() {
  emit('submit', {
    id: `ai-${Date.now()}`,
    name: result.name,
    category: 'electrical',
    sizeLabel: `${result.w}×${result.d}×${result.h}`,
    w: result.w / 1000,
    d: result.d / 1000,
    h: result.h / 1000,
    thumb: '#e67e22',
    favorite: true,
    brand: result.brand,
    version: 'v1.0.0'
  })
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal">
      <header>
        <h3>AI 识别：图片转资产</h3>
        <button type="button" @click="emit('close')">×</button>
      </header>
      <div class="cols">
        <div class="col">
          <div class="upload">
            <img v-if="previewUrl" :src="previewUrl" alt="ref" />
            <div v-else class="ph">上传设备照片</div>
            <input type="file" accept="image/*" @change="onFile(($event.target as HTMLInputElement).files)" />
          </div>
          <button type="button" class="primary" :disabled="!previewUrl || stage === 'running'" @click="recognize">
            {{ stage === 'running' ? 'AI 识别中…' : '开始识别' }}
          </button>
          <div v-if="stage === 'running'" class="bar"><i :style="{ width: progress + '%' }" /></div>
        </div>
        <div class="col">
          <template v-if="stage === 'done'">
            <div class="card">
              <div class="score">置信度 {{ result.confidence }}%</div>
              <h4>{{ result.name }}</h4>
              <p>品牌 {{ result.brand }}</p>
              <p>建议尺寸 {{ result.w }} × {{ result.d }} × {{ result.h }} 毫米</p>
              <div class="mesh-ph">生成三维预览（示意）</div>
            </div>
            <button type="button" class="primary" @click="importAsset">创建资产</button>
          </template>
          <p v-else class="hint">上传图片后开始识别，将生成可放置的素材条目（示意）。</p>
        </div>
      </div>
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
  width: min(720px, 94vw);
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
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}
.upload {
  position: relative;
  height: 200px;
  border-radius: 12px;
  border: 1px dashed #3b5bdb;
  overflow: hidden;
  background: #121c2a;
  margin-bottom: 10px;
}
.upload img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ph {
  height: 100%;
  display: grid;
  place-items: center;
  color: #6d8199;
}
.upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.primary {
  border: 0;
  width: 100%;
  border-radius: 8px;
  padding: 9px;
  background: #1f6fff;
  color: #fff;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bar {
  margin-top: 8px;
  height: 6px;
  background: #1a2738;
  border-radius: 999px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #3dd6ff, #1f6fff);
}
.card {
  background: #121c2a;
  border: 1px solid #223247;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
}
.score {
  color: #22c55e;
  font-size: 12px;
}
.card h4 {
  margin: 6px 0;
}
.card p {
  margin: 4px 0;
  font-size: 12px;
  color: #8ea4bd;
}
.mesh-ph {
  margin-top: 10px;
  height: 100px;
  border-radius: 8px;
  background: radial-gradient(circle at 50% 40%, #3a4a5c, #151e2b);
  display: grid;
  place-items: center;
  color: #7b90a8;
  font-size: 12px;
}
.hint {
  color: #6d8199;
  font-size: 13px;
}
@media (max-width: 700px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
