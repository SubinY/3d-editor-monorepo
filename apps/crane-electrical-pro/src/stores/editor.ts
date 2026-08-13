import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { EditorDocumentJSON, Tool2D, TransformMode } from '@mh/3d-editor'

export type ViewMode = '2d' | 'split' | '3d'
export type LeftTab = 'resource' | 'outline'
export type RightTab = 'property' | 'scene' | 'data'

const DOC_KEY = 'crane-electrical-pro:document:v2'

export const useEditorStore = defineStore('editor', () => {
  const projectName = ref('Substation B - 电气室设计')
  const viewMode = ref<ViewMode>('split')
  const tool = ref<Tool2D>('select')
  const transformMode = ref<TransformMode>('translate')
  const leftCollapsed = ref(false)
  const rightCollapsed = ref(false)
  const leftTab = ref<LeftTab>('resource')
  const rightTab = ref<RightTab>('property')
  const statusText = ref('就绪')
  const selectionCount = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const snapEnabled = ref(true)
  const collisionEnabled = ref(true)
  const gridSizeMm = ref(500)
  const unit = ref('mm')

  function persistDocument(json: EditorDocumentJSON) {
    try {
      sessionStorage.setItem(DOC_KEY, JSON.stringify(json))
    } catch {
      /* ignore quota */
    }
  }

  function loadPersistedDocument(): EditorDocumentJSON | null {
    try {
      const raw = sessionStorage.getItem(DOC_KEY)
      if (!raw) return null
      return JSON.parse(raw) as EditorDocumentJSON
    } catch {
      return null
    }
  }

  return {
    projectName,
    viewMode,
    tool,
    transformMode,
    leftCollapsed,
    rightCollapsed,
    leftTab,
    rightTab,
    statusText,
    selectionCount,
    canUndo,
    canRedo,
    snapEnabled,
    collisionEnabled,
    gridSizeMm,
    unit,
    persistDocument,
    loadPersistedDocument
  }
})
