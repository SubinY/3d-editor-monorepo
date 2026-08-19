<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CatalogItem, DocumentKind } from '@mh/3d-editor'
import * as api from '@/business/api'
import AssetPreviewViewport from './AssetPreviewViewport.vue'
import type { PreviewSpec } from './AssetPreviewViewport.vue'

const props = defineProps<{
  show: boolean
  kind: DocumentKind
  /** 再编辑时预填 */
  editItem?: CatalogItem | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [item: CatalogItem]
}>()

type SourceTab = 'local' | 'ai'

const sourceTab = ref<SourceTab>('local')
const name = ref('')
const footprint = reactive({ width: 0.1, depth: 0.1, height: 0.14 })
const placeScene = ref(false)
const placeContainer = ref(true)
const category = ref<'component' | 'equipment'>('component')
const draftId = ref(`draft-${crypto.randomUUID().slice(0, 8)}`)
const version = ref('1.0.0')
const sourceLabel = ref('本地')

const localFileName = ref('')
const localFileSize = ref('')
const glbUrl = ref('')

const aiImageName = ref('')
const aiPrompt = ref('')
const aiImageBase64 = ref('')
const aiMime = ref('image/png')
const aiFactoryDraftId = ref('')
const aiPreviewUrl = ref('')
const generating = ref(false)
const saving = ref(false)

const previewRef = ref<InstanceType<typeof AssetPreviewViewport>>()
const previewSpec = ref<PreviewSpec>(null)
const previewReady = ref(false)

const canSave = computed(() => {
  if (saving.value || generating.value) return false
  if (!name.value.trim()) return false
  if (!previewReady.value || !previewSpec.value) return false
  if (!placeScene.value && !placeContainer.value) return false
  return true
})

function resetForOpen() {
  const edit = props.editItem
  if (edit) {
    draftId.value = edit.id
    version.value = edit.version
    name.value = edit.name
    footprint.width = edit.footprint.width
    footprint.depth = edit.footprint.depth
    footprint.height = edit.footprint.height ?? 0.14
    placeScene.value = edit.placeableIn.includes('scene')
    placeContainer.value = edit.placeableIn.includes('container')
    category.value =
      edit.category === 'equipment' || edit.kind === 'equipment' ? 'equipment' : 'component'
    const m = edit.model3d
    if (m?.type === 'gltf') {
      sourceTab.value = 'local'
      sourceLabel.value = '本地'
      glbUrl.value = m.url
      previewSpec.value = { type: 'gltf', url: m.url }
      previewReady.value = true
    } else if (m?.type === 'procedural' && m.url) {
      sourceTab.value = 'ai'
      sourceLabel.value = 'AI'
      aiPreviewUrl.value = m.url
      previewSpec.value = {
        type: 'procedural',
        url: m.url,
        footprint: { ...footprint },
        item: edit
      }
      previewReady.value = true
    }
    return
  }

  sourceTab.value = 'local'
  name.value = ''
  draftId.value = `draft-${crypto.randomUUID().slice(0, 8)}`
  version.value = '1.0.0'
  sourceLabel.value = '本地'
  localFileName.value = ''
  localFileSize.value = ''
  glbUrl.value = ''
  aiImageName.value = ''
  aiPrompt.value = ''
  aiImageBase64.value = ''
  aiFactoryDraftId.value = ''
  aiPreviewUrl.value = ''
  previewSpec.value = null
  previewReady.value = false
  generating.value = false
  saving.value = false

  if (props.kind === 'scene') {
    placeScene.value = true
    placeContainer.value = false
    category.value = 'equipment'
    footprint.width = 0.8
    footprint.depth = 0.6
    footprint.height = 2
  } else {
    placeScene.value = false
    placeContainer.value = true
    category.value = 'component'
    footprint.width = 0.1
    footprint.depth = 0.1
    footprint.height = 0.14
  }
}

watch(
  () => props.show,
  show => {
    if (show) resetForOpen()
  }
)

function onSourceTabChange(tab: string | number | boolean | undefined) {
  const next = (tab === 'ai' ? 'ai' : 'local') as SourceTab
  sourceTab.value = next
  sourceLabel.value = next === 'local' ? '本地' : 'AI'
  previewSpec.value = null
  previewReady.value = false
  if (next === 'local' && glbUrl.value) {
    previewSpec.value = { type: 'gltf', url: glbUrl.value }
    previewReady.value = true
  }
  if (next === 'ai' && aiPreviewUrl.value) {
    previewSpec.value = {
      type: 'procedural',
      url: aiPreviewUrl.value,
      footprint: { ...footprint }
    }
    previewReady.value = true
  }
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

async function onPickGlb(file: File | undefined) {
  if (!file) return
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
    ElMessage.error('请选择 .glb / .gltf 文件')
    return
  }
  try {
    localFileName.value = file.name
    localFileSize.value = formatSize(file.size)
    if (!name.value.trim()) name.value = file.name.replace(/\.(glb|gltf)$/i, '')
    const uploaded = await api.uploadGlbAsset(file)
    glbUrl.value = uploaded.url
    previewSpec.value = { type: 'gltf', url: uploaded.url }
    previewReady.value = true
  } catch (e) {
    previewReady.value = false
    ElMessage.error(e instanceof Error ? e.message : '上传失败')
  }
}

function onGlbInput(ev: Event) {
  const input = ev.target as HTMLInputElement
  void onPickGlb(input.files?.[0])
  input.value = ''
}

function onGlbDrop(ev: DragEvent) {
  ev.preventDefault()
  void onPickGlb(ev.dataTransfer?.files?.[0])
}

async function onPickImage(file: File | undefined) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片')
    return
  }
  aiImageName.value = file.name
  aiMime.value = file.type || 'image/png'
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读图失败'))
    reader.readAsDataURL(file)
  })
  aiImageBase64.value = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl
  if (!name.value.trim()) name.value = file.name.replace(/\.\w+$/, '')
}

function onImageInput(ev: Event) {
  const input = ev.target as HTMLInputElement
  void onPickImage(input.files?.[0])
  input.value = ''
}

async function runGenerate() {
  if (!aiImageBase64.value) {
    ElMessage.warning('请先上传参考图')
    return
  }
  generating.value = true
  previewReady.value = false
  previewSpec.value = null
  try {
    const gen = await api.generateModelFactory({
      imageBase64: aiImageBase64.value,
      mimeType: aiMime.value,
      name: name.value.trim() || undefined,
      footprint: { ...footprint }
    })
    aiFactoryDraftId.value = gen.draftId
    if (gen.name) name.value = gen.name
    if (gen.footprintHint) {
      footprint.width = gen.footprintHint.width
      footprint.depth = gen.footprintHint.depth
      footprint.height = gen.footprintHint.height
    }
    const built = await api.previewBuildModelFactory(gen.draftId)
    aiPreviewUrl.value = built.url
    previewSpec.value = {
      type: 'procedural',
      url: built.url,
      footprint: { ...footprint }
    }
    previewReady.value = true
    ElMessage.success('生成完成，请确认预览')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '生成失败')
  } finally {
    generating.value = false
  }
}

function onPreviewLoaded(measured: { width: number; depth: number; height?: number }) {
  footprint.width = measured.width
  footprint.depth = measured.depth
  footprint.height = measured.height ?? footprint.height
}

function close() {
  emit('update:show', false)
}

async function save() {
  if (!canSave.value || !previewSpec.value) return
  saving.value = true
  try {
    const placeableIn: DocumentKind[] = []
    if (placeScene.value) placeableIn.push('scene')
    if (placeContainer.value) placeableIn.push('container')

    let item: CatalogItem

    if (previewSpec.value.type === 'gltf') {
      item = {
        id: draftId.value,
        version: version.value,
        name: name.value.trim(),
        kind: category.value,
        category: category.value,
        placeableIn,
        footprint: {
          width: footprint.width,
          depth: footprint.depth,
          height: footprint.height
        },
        thumb: '#5dade2',
        model3d: { type: 'gltf', url: previewSpec.value.url },
        metadata: { source: 'local-glb' }
      }
    } else {
      let modelUrl = previewSpec.value.url
      let modelId = draftId.value
      if (aiFactoryDraftId.value) {
        const compiled = await api.compileModelFactory({
          draftId: aiFactoryDraftId.value,
          id: draftId.value,
          version: version.value
        })
        modelUrl = compiled.url
        modelId = draftId.value
        if (compiled.catalogItem?.name) {
          /* keep user name */
        }
      }
      item = {
        id: draftId.value,
        version: version.value,
        name: name.value.trim(),
        kind: category.value,
        category: category.value,
        placeableIn,
        footprint: {
          width: footprint.width,
          depth: footprint.depth,
          height: footprint.height
        },
        thumb: '#5dade2',
        model3d: { type: 'procedural', id: modelId, url: modelUrl },
        metadata: { source: 'ai-factory', factoryDraftId: aiFactoryDraftId.value || undefined }
      }
    }

    const saved = await api.saveAssetDraft(item)
    emit('saved', saved)
    ElMessage.success('已存为我的素材')
    close()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="show" class="mask" @mousedown.self="close">
    <div class="modal" role="dialog" aria-modal="true">
      <header class="header">
        <div>
          <h2>导入模型</h2>
          <p class="sub">草稿 → 预览 → 存为我的素材（不进默认盘）</p>
        </div>
        <el-button text @click="close">关闭</el-button>
      </header>

      <div class="body">
        <aside class="source">
          <el-radio-group v-model="sourceTab" size="small" @change="onSourceTabChange">
            <el-radio-button value="local">本地模型</el-radio-button>
            <el-radio-button value="ai">看图生成</el-radio-button>
          </el-radio-group>

          <div v-if="sourceTab === 'local'" class="pane">
            <div
              class="drop"
              @dragover.prevent
              @drop="onGlbDrop"
            >
              <p>拖入 .glb / .gltf，或</p>
              <label class="file-btn">
                选择文件
                <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" hidden @change="onGlbInput" />
              </label>
            </div>
            <p v-if="localFileName" class="meta">{{ localFileName }} · {{ localFileSize }}</p>
          </div>

          <div v-else class="pane">
            <p class="ai-hint">生成结果需预览确认后才会出现在资源列表</p>
            <label class="file-btn block">
              上传参考图
              <input type="file" accept="image/*" hidden @change="onImageInput" />
            </label>
            <p v-if="aiImageName" class="meta">{{ aiImageName }}</p>
            <el-input
              v-model="aiPrompt"
              type="textarea"
              :rows="2"
              placeholder="可选说明（当前生成管线以图片为主）"
            />
            <el-button
              type="primary"
              class="gen-btn"
              :loading="generating"
              :disabled="!aiImageBase64 || generating"
              @click="runGenerate"
            >
              生成
            </el-button>
          </div>
        </aside>

        <section class="preview">
          <span class="badge">未保存草稿</span>
          <AssetPreviewViewport ref="previewRef" :spec="previewSpec" @loaded="onPreviewLoaded" />
          <p v-if="!previewReady" class="preview-empty">选择来源并完成加载后在此预览</p>
        </section>

        <aside class="props">
          <label class="field">
            <span>名称</span>
            <el-input v-model="name" placeholder="必填" />
          </label>
          <label class="field">
            <span>宽 (m)</span>
            <el-input-number
              v-model="footprint.width"
              :min="0.01"
              :step="0.01"
              :controls="false"
              class="dim-input"
            />
          </label>
          <label class="field">
            <span>深 (m)</span>
            <el-input-number
              v-model="footprint.depth"
              :min="0.01"
              :step="0.01"
              :controls="false"
              class="dim-input"
            />
          </label>
          <label class="field">
            <span>高 (m)</span>
            <el-input-number
              v-model="footprint.height"
              :min="0.01"
              :step="0.01"
              :controls="false"
              class="dim-input"
            />
          </label>
          <p class="note">改尺寸只影响落点碰撞盒，不拉伸预览模型</p>
          <div class="field">
            <span>可放置</span>
            <div class="checks">
              <el-checkbox v-model="placeScene">场景</el-checkbox>
              <el-checkbox v-model="placeContainer">柜内</el-checkbox>
            </div>
          </div>
          <label class="field">
            <span>分类</span>
            <el-select v-model="category" style="width: 100%">
              <el-option label="元器件 component" value="component" />
              <el-option label="设备 equipment" value="equipment" />
            </el-select>
          </label>
          <div class="readonly">
            <div>来源：{{ sourceLabel }}</div>
            <div>id@version：{{ draftId }}@{{ version }}</div>
          </div>
        </aside>
      </div>

      <footer class="footer">
        <el-button @click="close">取消</el-button>
        <el-button type="primary" :disabled="!canSave" :loading="saving" @click="save">
          存为我的素材
        </el-button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  padding: 24px;
}

.modal {
  width: min(1120px, 100%);
  height: min(720px, 100%);
  background: #0e1621;
  border: 1px solid #1d2c3e;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #cfe0f0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #1d2c3e;
  background: #101823;
}

.header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e8f1fa;
}

.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7a8fa6;
}

.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px 1fr 260px;
  gap: 0;
}

.source,
.props {
  padding: 14px;
  border-right: 1px solid #1d2c3e;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.props {
  border-right: none;
  border-left: 1px solid #1d2c3e;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drop {
  border: 1px dashed #2c3e52;
  border-radius: 8px;
  padding: 20px 12px;
  text-align: center;
  color: #7a8fa6;
  font-size: 13px;
}

.file-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  background: #1a2738;
  color: #4dabf7;
  cursor: pointer;
  font-size: 13px;
}

.file-btn.block {
  margin-top: 0;
  width: 100%;
}

.meta {
  margin: 0;
  font-size: 12px;
  color: #7a8fa6;
  word-break: break-all;
}

.ai-hint {
  margin: 0;
  font-size: 12px;
  color: #7a8fa6;
  line-height: 1.5;
}

.gen-btn {
  width: 100%;
}

.preview {
  position: relative;
  padding: 14px;
  min-width: 0;
}

.badge {
  position: absolute;
  z-index: 2;
  top: 22px;
  left: 22px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(14, 22, 33, 0.85);
  color: #7ec8ff;
  border: 1px solid #2c3e52;
}

.preview-empty {
  position: absolute;
  inset: 14px;
  display: grid;
  place-items: center;
  margin: 0;
  pointer-events: none;
  color: #44556b;
  font-size: 13px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #7a8fa6;
}

.dim-input {
  width: 100%;
}

.dim-input :deep(.el-input__wrapper) {
  width: 100%;
}

.dim-input :deep(.el-input-number) {
  width: 100%;
}

.checks {
  display: flex;
  gap: 12px;
}

.note {
  margin: -4px 0 0;
  font-size: 11px;
  color: #44556b;
}

.readonly {
  margin-top: auto;
  font-size: 11px;
  color: #4d6076;
  line-height: 1.6;
  padding-top: 8px;
  border-top: 1px solid #1d2c3e;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid #1d2c3e;
  background: #101823;
}
</style>
