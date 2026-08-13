<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { panel } from '@mh/3d-editor-assets/common'

const props = defineProps<{
  show: boolean
  modelValue: panel.PanelContentJSON | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: [content: panel.PanelContentJSON]
}>()

const draft = ref<panel.PanelContentJSON>(panel.createDefaultContent())
const selectedId = ref('')
const previewUrl = ref('')

const selected = computed(() => draft.value.elements.find(e => e.id === selectedId.value) ?? null)

watch(
  () => [props.show, props.modelValue] as const,
  async ([show, value]) => {
    if (!show) return
    draft.value = panel.cloneContent(value ?? panel.createDefaultContent())
    selectedId.value = draft.value.elements[0]?.id ?? ''
    await refreshPreview()
  },
  { immediate: true }
)

async function refreshPreview() {
  const canvas = await panel.bakeToCanvas(draft.value)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = canvas.toDataURL('image/png')
}

function selectEl(id: string) {
  selectedId.value = id
}

function addText() {
  const el: panel.PanelElement = {
    id: panel.nextElementId('text'),
    type: 'text',
    name: '文本',
    left: 80,
    top: 80,
    width: 400,
    height: 80,
    text: '新文本',
    color: '#ffffff',
    fontSize: 48,
    fontWeight: 700,
    align: 'left',
    baseline: 'middle'
  }
  draft.value.elements.push(el)
  selectedId.value = el.id
  void refreshPreview()
}

function addImage() {
  const el: panel.PanelElement = {
    id: panel.nextElementId('img'),
    type: 'image',
    name: '图片',
    left: 40,
    top: 40,
    width: 120,
    height: 120,
    url: ''
  }
  draft.value.elements.push(el)
  selectedId.value = el.id
  void refreshPreview()
}

function removeSelected() {
  if (!selectedId.value) return
  draft.value.elements = draft.value.elements.filter(e => e.id !== selectedId.value)
  selectedId.value = draft.value.elements[0]?.id ?? ''
  void refreshPreview()
}

function onPickImage(file: File | null) {
  if (!file || !selected.value || selected.value.type !== 'image') return
  const reader = new FileReader()
  reader.onload = () => {
    if (selected.value && selected.value.type === 'image') {
      selected.value.url = String(reader.result || '')
      void refreshPreview()
    }
  }
  reader.readAsDataURL(file)
}

function confirm() {
  emit('confirm', panel.cloneContent(draft.value))
  emit('update:show', false)
}

function cancel() {
  emit('update:show', false)
}
</script>

<template>
  <div v-if="show" class="mask" @click.self="cancel">
    <div class="dialog" role="dialog" aria-modal="true">
      <header class="head">
        <span>面板编辑</span>
        <button type="button" class="x" @click="cancel">×</button>
      </header>

      <div class="body">
        <aside class="left">
          <div class="label">基础</div>
          <button type="button" class="tool" @click="addText">文本</button>
          <button type="button" class="tool" @click="addImage">图片</button>
          <div class="label mt">图层</div>
          <button
            v-for="el in draft.elements"
            :key="el.id"
            type="button"
            class="layer"
            :class="{ active: el.id === selectedId }"
            @click="selectEl(el.id)"
          >
            {{ el.name || el.type }} · {{ el.type === 'text' ? el.text.slice(0, 8) : 'img' }}
          </button>
        </aside>

        <main class="center">
          <div class="preview-wrap">
            <img v-if="previewUrl" class="preview" :src="previewUrl" alt="panel preview" />
          </div>
          <div class="hint">预览为烘焙贴图；场景内为 Sprite，始终朝向相机。</div>
        </main>

        <aside class="right">
          <div class="label">面板</div>
          <label class="field">
            <span>宽度</span>
            <input v-model.number="draft.width" type="number" step="64" min="128" @change="refreshPreview" />
          </label>
          <label class="field">
            <span>高度</span>
            <input v-model.number="draft.height" type="number" step="64" min="128" @change="refreshPreview" />
          </label>
          <label class="field">
            <span>世界宽 (m)</span>
            <input v-model.number="draft.worldWidth" type="number" step="0.1" min="0.2" @change="refreshPreview" />
          </label>
          <label class="field">
            <span>背景色</span>
            <input v-model="draft.background" type="text" placeholder="transparent" @change="refreshPreview" />
          </label>

          <template v-if="selected">
            <div class="label mt">选中内容</div>
            <label class="field">
              <span>名称</span>
              <input v-model="selected.name" @change="refreshPreview" />
            </label>
            <div class="row2">
              <label class="field">
                <span>左</span>
                <input v-model.number="selected.left" type="number" @change="refreshPreview" />
              </label>
              <label class="field">
                <span>上</span>
                <input v-model.number="selected.top" type="number" @change="refreshPreview" />
              </label>
            </div>
            <div class="row2">
              <label class="field">
                <span>宽</span>
                <input v-model.number="selected.width" type="number" @change="refreshPreview" />
              </label>
              <label class="field">
                <span>高</span>
                <input v-model.number="selected.height" type="number" @change="refreshPreview" />
              </label>
            </div>

            <template v-if="selected.type === 'text'">
              <label class="field">
                <span>文本</span>
                <input v-model="selected.text" @change="refreshPreview" />
              </label>
              <label class="field">
                <span>字号</span>
                <input v-model.number="selected.fontSize" type="number" @change="refreshPreview" />
              </label>
              <label class="field">
                <span>颜色</span>
                <input v-model="selected.color" type="color" @input="refreshPreview" />
              </label>
              <label class="field">
                <span>条背景</span>
                <input
                  :value="selected.background || '#000000'"
                  type="color"
                  @input="
                    selected.background = ($event.target as HTMLInputElement).value;
                    refreshPreview()
                  "
                />
              </label>
            </template>

            <template v-else>
              <label class="field">
                <span>图片 URL</span>
                <input v-model="selected.url" @change="refreshPreview" />
              </label>
              <label class="field">
                <span>本地图片</span>
                <input
                  type="file"
                  accept="image/*"
                  @change="onPickImage(($event.target as HTMLInputElement).files?.[0] ?? null)"
                />
              </label>
            </template>

            <button type="button" class="danger" @click="removeSelected">删除内容</button>
          </template>
        </aside>
      </div>

      <footer class="foot">
        <button type="button" class="ghost" @click="cancel">取消</button>
        <button type="button" class="primary" @click="confirm">确认</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
}

.dialog {
  width: min(1100px, 96vw);
  height: min(720px, 92vh);
  background: #121a24;
  border: 1px solid var(--border-subtle, #2a3644);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  color: #e8eef5;
}

.head {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid #243041;
  font-weight: 600;
}

.x {
  border: 0;
  background: transparent;
  color: #9fb0c3;
  font-size: 22px;
  cursor: pointer;
}

.body {
  flex: 1;
  display: grid;
  grid-template-columns: 160px 1fr 240px;
  min-height: 0;
}

.left,
.right {
  padding: 10px;
  border-right: 1px solid #243041;
  overflow: auto;
}

.right {
  border-right: 0;
  border-left: 1px solid #243041;
}

.center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #0b1118;
}

.preview-wrap {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 16px;
}

.preview {
  max-width: 100%;
  max-height: 100%;
  image-rendering: auto;
  background: repeating-conic-gradient(#1a2430 0% 25%, #101820 0% 50%) 50% / 16px 16px;
}

.hint {
  padding: 8px 12px;
  font-size: 11px;
  color: #8aa0b5;
  border-top: 1px solid #243041;
}

.label {
  font-size: 11px;
  color: #8aa0b5;
  margin-bottom: 6px;
}

.mt {
  margin-top: 12px;
}

.tool,
.layer,
.ghost,
.primary,
.danger {
  width: 100%;
  height: 32px;
  margin-bottom: 6px;
  border-radius: 4px;
  border: 1px solid #2d3b4c;
  background: #182230;
  color: #e8eef5;
  cursor: pointer;
  font-size: 12px;
}

.layer.active {
  border-color: #3b82f6;
  background: #1d3350;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  font-size: 10px;
  color: #8aa0b5;
}

.field input {
  height: 28px;
  border-radius: 4px;
  border: 1px solid #2d3b4c;
  background: #0f1720;
  color: #e8eef5;
  padding: 0 6px;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.danger {
  border-color: #7f1d1d;
  color: #fecaca;
  margin-top: 8px;
}

.foot {
  height: 52px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  align-items: center;
  padding: 0 14px;
  border-top: 1px solid #243041;
}

.ghost {
  width: auto;
  padding: 0 14px;
}

.primary {
  width: auto;
  padding: 0 18px;
  background: #2563eb;
  border-color: #2563eb;
}
</style>
