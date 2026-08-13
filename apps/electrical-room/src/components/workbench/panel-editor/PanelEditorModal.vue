<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { panel } from '@mh/3d-editor-assets/common'
import PanelPalette from './PanelPalette.vue'
import PanelCanvas from './PanelCanvas.vue'
import PanelInspector from './PanelInspector.vue'

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
let previewToken = 0

const selected = computed(
  () => draft.value.elements.find(e => e.id === selectedId.value) ?? null
)

watch(
  () => [props.show, props.modelValue] as const,
  async ([show, value]) => {
    if (!show) return
    draft.value = panel.cloneContent(value ?? panel.createDefaultContent())
    selectedId.value = ''
    await refreshPreview()
  },
  { immediate: true }
)

async function refreshPreview() {
  const token = ++previewToken
  const canvas = await panel.bakeToCanvas(draft.value)
  if (token !== previewToken) return
  previewUrl.value = canvas.toDataURL('image/png')
}

function selectEl(id: string) {
  selectedId.value = id
}

function reorderLayers(ids: string[]) {
  const map = new Map(draft.value.elements.map(e => [e.id, e]))
  draft.value.elements = ids.map(id => map.get(id)!).filter(Boolean)
  void refreshPreview()
}

function addElement(kind: 'text' | 'image', left: number, top: number) {
  if (kind === 'text') {
    const el: panel.PanelElement = {
      id: panel.nextElementId('text'),
      type: 'text',
      name: '文本',
      left,
      top,
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
  } else {
    const el: panel.PanelElement = {
      id: panel.nextElementId('img'),
      type: 'image',
      name: '图片',
      left,
      top,
      width: 120,
      height: 120,
      url: ''
    }
    draft.value.elements.push(el)
    selectedId.value = el.id
  }
  void refreshPreview()
}

function onDropTool(payload: { kind: 'text' | 'image'; left: number; top: number }) {
  addElement(payload.kind, payload.left, payload.top)
}

function removeSelected() {
  if (!selectedId.value) return
  draft.value.elements = draft.value.elements.filter(e => e.id !== selectedId.value)
  selectedId.value = ''
  void refreshPreview()
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
        <span>面板内容编辑</span>
        <button type="button" class="x" @click="cancel">×</button>
      </header>

      <div class="body">
        <PanelPalette
          :elements="draft.elements"
          :selected-id="selectedId"
          @select="selectEl"
          @reorder="reorderLayers"
        />
        <PanelCanvas
          :preview-url="previewUrl"
          :draft="draft"
          :selected-id="selectedId"
          @drop-tool="onDropTool"
          @update:selected-id="selectEl"
          @change="refreshPreview"
        />
        <PanelInspector
          :draft="draft"
          :selected="selected"
          @change="refreshPreview"
          @remove-selected="removeSelected"
        />
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
  width: min(1200px, 96vw);
  height: min(780px, 92vh);
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
  grid-template-columns: 168px 1fr 280px;
  min-height: 0;
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

.ghost,
.primary {
  height: 32px;
  border-radius: 4px;
  border: 1px solid #2d3b4c;
  background: #182230;
  color: #e8eef5;
  cursor: pointer;
  font-size: 12px;
  padding: 0 14px;
}

.primary {
  padding: 0 18px;
  background: #2563eb;
  border-color: #2563eb;
}
</style>
