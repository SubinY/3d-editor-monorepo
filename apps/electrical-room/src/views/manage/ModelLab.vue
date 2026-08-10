<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  generateModelFactory,
  previewModelFactory,
  publishModelFactory,
  updateModelFactoryDraft
} from '@/business/api'
import { ModelPreviewViewport } from './model-preview-viewport'

const fileInput = ref<HTMLInputElement | null>(null)
const previewEl = ref<HTMLElement | null>(null)
const imagePreview = ref('')
const mimeType = ref('image/png')
const imageBase64 = ref('')
const name = ref('AI Component')
const assetId = ref('comp-ai-demo')
const version = ref('1.0.0')
const draftId = ref('')
const sourceCode = ref('')
/** 宽(X) / 深(Z) / 高(Y)，米；生成前必填，作为固定包络 */
const footprint = ref({ width: 0.14, depth: 0.11, height: 0.255 })
const busy = ref(false)
const publishedUrl = ref('')
const statusText = ref('上传参考图并填写宽×深×高后再生成')

const footprintValid = computed(() => {
  const { width, depth, height } = footprint.value
  return [width, depth, height].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)
})

const canGenerate = computed(() => !!imageBase64.value && footprintValid.value && !busy.value)

let preview: ModelPreviewViewport | undefined

onMounted(() => {
  if (previewEl.value) preview = new ModelPreviewViewport(previewEl.value)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  preview?.dispose()
})

function onResize() {
  preview?.resize()
}

function pickFile() {
  fileInput.value?.click()
}

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  mimeType.value = file.type || 'image/png'
  const dataUrl = await readAsDataUrl(file)
  imagePreview.value = dataUrl
  imageBase64.value = dataUrl
  statusText.value = footprintValid.value
    ? `已选择 ${file.name}，规格已填，可生成`
    : `已选择 ${file.name}，请填写宽×深×高（米）`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function generate() {
  if (!imageBase64.value) {
    ElMessage.warning('请先上传图片')
    return
  }
  if (!footprintValid.value) {
    ElMessage.warning('请填写有效的宽、深、高（米，均须 > 0）')
    return
  }
  busy.value = true
  const fp = {
    width: Number(footprint.value.width),
    depth: Number(footprint.value.depth),
    height: Number(footprint.value.height)
  }
  statusText.value = 'Kimi Stage1 inventory… / Stage2 createModel…'
  try {
    const res = await generateModelFactory({
      imageBase64: imageBase64.value,
      mimeType: mimeType.value,
      name: name.value,
      footprint: fp
    })
    draftId.value = res.draftId
    sourceCode.value = res.sourceCode
    // 以用户规格为准，不用模型估算覆盖
    footprint.value = { ...fp }
    const parts = res.partCount ?? res.inventory?.parts?.length ?? 0
    const cls = res.objectClass || res.inventory?.objectClass || ''
    statusText.value = `草稿 ${res.draftId}（${cls || 'ok'} · ${parts} parts · 固定 ${fp.width}×${fp.height}×${fp.depth} m）`
    await runPreview()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    statusText.value = msg
    ElMessage.error(msg)
  } finally {
    busy.value = false
  }
}

async function saveDraft() {
  if (!draftId.value) return
  busy.value = true
  try {
    await updateModelFactoryDraft(draftId.value, {
      sourceCode: sourceCode.value,
      name: name.value,
      footprintHint: footprint.value
    })
    ElMessage.success('草稿已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e))
  } finally {
    busy.value = false
  }
}

async function runPreview() {
  if (!draftId.value) {
    ElMessage.warning('请先生成')
    return
  }
  busy.value = true
  statusText.value = '正在打包预览模块…'
  try {
    await updateModelFactoryDraft(draftId.value, {
      sourceCode: sourceCode.value,
      name: name.value,
      footprintHint: footprint.value
    })
    const { url } = await previewModelFactory(draftId.value)
    await nextTick()
    await preview?.loadModule(`${url}?t=${Date.now()}`, footprint.value)
    statusText.value = `预览已加载 ${url}`
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    statusText.value = msg
    ElMessage.error(msg)
  } finally {
    busy.value = false
  }
}

async function publish() {
  if (!draftId.value) {
    ElMessage.warning('请先生成')
    return
  }
  busy.value = true
  statusText.value = '正在发布…'
  try {
    await updateModelFactoryDraft(draftId.value, {
      sourceCode: sourceCode.value,
      name: name.value,
      footprintHint: footprint.value
    })
    const out = await publishModelFactory({
      draftId: draftId.value,
      id: assetId.value,
      version: version.value
    })
    publishedUrl.value = out.url
    statusText.value = `已发布 ${out.url}，并写入 Catalog`
    ElMessage.success('发布成功')
    await preview?.loadModule(`${out.url}?t=${Date.now()}`, footprint.value)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    statusText.value = msg
    ElMessage.error(msg)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="lab">
    <header class="head">
      <div>
        <h1>模型工厂 Lab</h1>
        <p class="sub">
          上传参考图 → 填写固定宽深高 → Kimi 两段式 → 预览 → 发布
        </p>
      </div>
      <el-tag type="warning" effect="plain">KIMI_API_KEY 仅服务端 .env；勿提交</el-tag>
    </header>

    <div class="grid">
      <section class="panel">
        <h2>1. 参考图</h2>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
        <div class="row">
          <el-button type="primary" @click="pickFile">选择图片</el-button>
          <el-input v-model="name" placeholder="资产名称" style="max-width: 220px" />
        </div>
        <div v-if="imagePreview" class="thumb-wrap">
          <img :src="imagePreview" alt="ref" class="thumb" />
        </div>
        <div class="dims mt">
          <div class="dims-label">外形规格（米，必填 · 宽×深×高）</div>
          <div class="row">
            <el-form-item label="宽 W" class="dim-item">
              <el-input-number
                v-model="footprint.width"
                :min="0.01"
                :max="2"
                :step="0.01"
                :precision="3"
                controls-position="right"
              />
            </el-form-item>
            <el-form-item label="深 D" class="dim-item">
              <el-input-number
                v-model="footprint.depth"
                :min="0.01"
                :max="2"
                :step="0.01"
                :precision="3"
                controls-position="right"
              />
            </el-form-item>
            <el-form-item label="高 H" class="dim-item">
              <el-input-number
                v-model="footprint.height"
                :min="0.01"
                :max="2"
                :step="0.01"
                :precision="3"
                controls-position="right"
              />
            </el-form-item>
          </div>
          <p class="hint dim-hint">
            对应 Catalog footprint：width(X) / depth(Z) / height(Y)。生成与发布均按此固定包络，不再由模型估算尺寸。
          </p>
        </div>
        <el-button
          type="success"
          :loading="busy"
          :disabled="!canGenerate"
          class="mt"
          @click="generate"
        >
          生成工厂源码
        </el-button>
        <p class="hint">{{ statusText }}</p>
      </section>

      <section class="panel">
        <h2>2. 预览</h2>
        <div ref="previewEl" class="preview" />
        <div class="row mt">
          <el-button :loading="busy" :disabled="!draftId" @click="runPreview">刷新预览</el-button>
        </div>
      </section>

      <section class="panel wide">
        <h2>3. 源码</h2>
        <el-input
          v-model="sourceCode"
          type="textarea"
          :rows="16"
          placeholder="生成后显示 createModel 源码，可手工微调"
          class="code"
        />
        <div class="row mt">
          <el-button :disabled="!draftId" :loading="busy" @click="saveDraft">保存草稿</el-button>
        </div>
      </section>

      <section class="panel wide">
        <h2>4. 发布</h2>
        <div class="row">
          <el-form-item label="id">
            <el-input v-model="assetId" style="width: 200px" />
          </el-form-item>
          <el-form-item label="version">
            <el-input v-model="version" style="width: 120px" />
          </el-form-item>
          <el-button type="primary" :loading="busy" :disabled="!draftId" @click="publish">
            发布到模型库
          </el-button>
        </div>
        <p v-if="publishedUrl" class="hint">
          model3d.url =
          <code>{{ publishedUrl }}</code>
          （Catalog 已 upsert，编辑器可 procedural + url 加载）
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.lab {
  padding: 20px 24px 40px;
  height: 100%;
  overflow: auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.sub {
  margin: 6px 0 0;
  color: #7a90a8;
  font-size: 13px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.panel {
  background: #0d1624;
  border: 1px solid #1a2a3d;
  border-radius: 10px;
  padding: 14px 16px;
}
.panel.wide {
  grid-column: 1 / -1;
}
h2 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #8ea4bd;
  font-weight: 600;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.mt {
  margin-top: 12px;
}
.thumb-wrap {
  margin-top: 12px;
  max-width: 280px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #243447;
}
.thumb {
  display: block;
  width: 100%;
}
.dims-label {
  font-size: 12px;
  color: #8ea4bd;
  margin-bottom: 6px;
}
.dim-item {
  margin-bottom: 0;
}
.dim-item :deep(.el-form-item__label) {
  color: #8ea4bd;
  font-size: 12px;
}
.dim-hint {
  margin-top: 4px;
}
.preview {
  width: 100%;
  height: 360px;
  border-radius: 8px;
  overflow: hidden;
  background: #070d16;
  border: 1px solid #243447;
}
.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #6b829c;
  line-height: 1.5;
}
.code :deep(textarea) {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}
code {
  color: #9fd0ff;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
