<template>
  <aside class="tree-panel">
    <div class="panel-header">
      <Icon icon="mdi:file-tree" class="header-icon" />
      <span>场景树</span>
    </div>

    <div v-if="editor.sceneTree.value.length === 0" class="empty-hint">
      <Icon icon="mdi:file-tree-outline" class="empty-icon" />
      <span>场景为空，从左侧资产库拖入资产</span>
    </div>

    <div v-else class="tree-list">
      <TreeItem
        v-for="node in editor.sceneTree.value"
        :key="node.id"
        :node="node"
        :selected-ids="editor.selectedIds.value"
        :depth="0"
        @select="editor.selectById"
        @toggle-visible="editor.toggleVisibility"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h } from 'vue'
import { Icon } from '@iconify/vue'
import { useSceneEditor } from '../composables/useSceneEditor'
import type { TreeNodeData } from '../types'

const editor = useSceneEditor()

const TreeItem = defineComponent({
  name: 'TreeItem',
  props: {
    node: { type: Object as () => TreeNodeData, required: true },
    selectedIds: { type: Array as () => string[], required: true },
    depth: { type: Number, default: 0 }
  },
  emits: ['select', 'toggle-visible'],
  setup(props, { emit }) {
    const expanded = ref(true)
    const isSelected = computed(() => props.selectedIds.includes(props.node.id))
    const hasChildren = computed(() => props.node.children && props.node.children.length > 0)

    return () => h('div', { class: 'tree-node-wrap' }, [
      h('div', {
        class: ['tree-node', { selected: isSelected.value }],
        style: { paddingLeft: `${props.depth * 16 + 8}px` },
        onClick: () => emit('select', props.node.id)
      }, [
        hasChildren.value
          ? h('span', {
              class: ['expand-toggle', { open: expanded.value }],
              onClick: (e: MouseEvent) => { e.stopPropagation(); expanded.value = !expanded.value }
            }, expanded.value ? '▾' : '▸')
          : h('span', { class: 'expand-spacer' }),
        h(Icon, { icon: 'mdi:cube-outline', style: { fontSize: '14px', color: 'var(--color-accent)', flexShrink: 0 } }),
        h('span', { class: 'tree-label' }, props.node.name),
        h('span', {
          class: ['vis-toggle', { hidden: !props.node.visible }],
          onClick: (e: MouseEvent) => { e.stopPropagation(); emit('toggle-visible', props.node.id) }
        }, [h(Icon, { icon: props.node.visible ? 'mdi:eye-outline' : 'mdi:eye-off-outline', style: { fontSize: '13px' } })])
      ]),
      hasChildren.value && expanded.value
        ? h('div', { class: 'tree-children' },
            props.node.children.map((child: TreeNodeData) =>
              h(TreeItem, {
                key: child.id, node: child, selectedIds: props.selectedIds,
                depth: props.depth + 1,
                onSelect: (id: string) => emit('select', id),
                onToggleVisible: (id: string) => emit('toggle-visible', id)
              })
            )
          )
        : null
    ])
  }
})
</script>

<style scoped>
.tree-panel {
  width: 220px;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}
.header-icon { font-size: 16px; color: var(--color-accent); }

.empty-hint {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 30px 16px;
  color: var(--color-text-muted); font-size: 12px; text-align: center;
}
.empty-icon { font-size: 28px; opacity: .25; }

.tree-list { flex: 1; overflow-y: auto; padding: 4px 0; }

.tree-node-wrap { width: 100%; }
.tree-node {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; cursor: pointer; font-size: 12px;
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
}
.tree-node:hover { background: var(--color-primary-dim); }
.tree-node.selected {
  background: var(--color-primary-dim); color: var(--color-text);
  border-left: 2px solid var(--color-accent);
}

.expand-toggle {
  width: 14px; font-size: 10px; text-align: center;
  color: var(--color-text-muted); cursor: pointer; flex-shrink: 0;
}
.expand-spacer { width: 14px; flex-shrink: 0; }

.tree-label {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.vis-toggle {
  opacity: .4; cursor: pointer; padding: 2px; border-radius: 3px; flex-shrink: 0;
  transition: opacity var(--transition-fast);
}
.vis-toggle:hover { opacity: 1; background: var(--color-surface-elevated); }
.vis-toggle.hidden { opacity: .15; }
</style>
