import { onBeforeUnmount, shallowRef, type Ref, type ShallowRef } from 'vue'
import type {
  EditorDocument,
  EditorDocumentJSON,
  EditorSession,
  Tool2D,
  TransformMode
} from '@mh/3d-editor'
import { createDefaultSceneJSON, createHostEditor } from './create-host-editor'
import { useEditorStore } from '@/stores/editor'

export type EditorSessionApi = {
  session: ShallowRef<EditorSession | undefined>
  doc: ShallowRef<EditorDocument | undefined>
  ready: Ref<boolean>
  boot: (opts: {
    el2d?: HTMLElement | null
    el3d?: HTMLElement | null
    document?: EditorDocumentJSON | null
    readonly?: boolean
  }) => Promise<EditorSession>
  dispose: () => void
  setTool: (tool: Tool2D) => void
  setTransformMode: (mode: TransformMode) => void
  undo: () => void
  redo: () => void
  removeSelected: () => void
  fitView: () => void
  focusSelection: () => void
  persist: () => void
}

export function useEditorSession(): EditorSessionApi {
  const store = useEditorStore()
  const session = shallowRef<EditorSession | undefined>()
  const doc = shallowRef<EditorDocument | undefined>()
  const ready = shallowRef(false)

  let unsubChange: (() => void) | undefined
  let unsubSel: (() => void) | undefined

  function syncHistory() {
    store.canUndo = doc.value?.history.canUndo() ?? false
    store.canRedo = doc.value?.history.canRedo() ?? false
  }

  function syncSelection() {
    const ids = doc.value?.selection.get() ?? []
    store.selectionCount = ids.length
  }

  async function boot(opts: {
    el2d?: HTMLElement | null
    el3d?: HTMLElement | null
    document?: EditorDocumentJSON | null
    readonly?: boolean
  }) {
    dispose()

    let initial = opts.document ?? store.loadPersistedDocument()
    if (!initial) {
      initial = await createDefaultSceneJSON()
      store.persistDocument(initial)
    }

    const s = await createHostEditor({
      document: initial,
      canvas2d: opts.el2d,
      canvas3d: opts.el3d,
      readonly: opts.readonly,
      onDenied: reason => {
        store.statusText = reason.startsWith('collision:')
          ? `碰撞拒绝：${reason.slice('collision:'.length)}`
          : `操作被拒绝：${reason}`
        console.warn('[editor]', reason)
      }
    })

    session.value = s
    doc.value = s.document
    ready.value = true

    const interaction = s.getInteraction()
    store.snapEnabled = interaction.snapEnabled
    store.collisionEnabled = interaction.collisionEnabled
    store.transformMode = interaction.transformMode

    syncHistory()
    syncSelection()

    unsubChange = s.document.on('change', () => {
      syncHistory()
      syncSelection()
    })
    unsubSel = s.document.on('selection:changed', () => {
      syncSelection()
    })

    return s
  }

  function dispose() {
    unsubChange?.()
    unsubSel?.()
    unsubChange = undefined
    unsubSel = undefined
    session.value?.dispose()
    session.value = undefined
    doc.value = undefined
    ready.value = false
  }

  function setTool(tool: Tool2D) {
    store.tool = tool
    session.value?.viewport2d?.setTool(tool)
  }

  function setTransformMode(mode: TransformMode) {
    session.value?.setTransformMode(mode)
    store.transformMode = session.value?.getInteraction().transformMode ?? mode
  }

  function undo() {
    doc.value?.history.undo()
  }

  function redo() {
    doc.value?.history.redo()
  }

  function removeSelected() {
    const d = doc.value
    if (!d) return
    const id = d.selection.first()
    if (!id) return
    if (d.getNode(id)) {
      d.commands.removeNode(id)
      return
    }
    if (d.getWall(id)) {
      d.commands.removeWall(id)
      d.selection.clear()
    }
  }

  function fitView() {
    session.value?.viewport2d?.fitBounds()
  }

  function focusSelection() {
    session.value?.viewport3d?.focusSelection()
  }

  function persist() {
    const s = session.value
    if (!s) return
    store.persistDocument(s.toJSON())
  }

  onBeforeUnmount(() => {
    persist()
    dispose()
  })

  return {
    session,
    doc,
    ready,
    boot,
    dispose,
    setTool,
    setTransformMode,
    undo,
    redo,
    removeSelected,
    fitView,
    focusSelection,
    persist
  }
}
