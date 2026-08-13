<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'

export type OutlineNode = {
  id: string
  name: string
  visible: boolean
  kind?: string
  children?: OutlineNode[]
}

const props = defineProps<{
  nodes: OutlineNode[]
  selectedId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  'toggle-visible': [id: string, visible: boolean]
}>()

const collapsed = ref<Record<string, boolean>>({
  structure: false,
  equipment: false,
  lighting: false,
  security: false,
  other: false
})

function classify(node: OutlineNode): string {
  const kind = (node.kind || '').toLowerCase()
  const name = node.name || ''
  if (kind === 'wall' || kind === 'door' || name.includes('墙') || name.includes('门') || name.includes('地板')) {
    return 'structure'
  }
  if (kind === 'cabinet' || name.includes('柜')) return 'equipment'
  if (kind === 'light' || name.includes('灯') || name.includes('LED')) return 'lighting'
  if (kind === 'camera' || name.includes('摄像') || name.includes('监控')) return 'security'
  return 'other'
}

const groups = computed(() => {
  const buckets: Record<string, OutlineNode[]> = {
    structure: [],
    equipment: [],
    lighting: [],
    security: [],
    other: []
  }
  for (const n of props.nodes) buckets[classify(n)].push(n)
  return [
    { key: 'structure', label: '建筑结构', nodes: buckets.structure },
    { key: 'equipment', label: '电气设备', nodes: buckets.equipment },
    { key: 'lighting', label: '照明系统', nodes: buckets.lighting },
    { key: 'security', label: '安防系统', nodes: buckets.security },
    { key: 'other', label: '其他', nodes: buckets.other }
  ].filter(g => g.nodes.length > 0)
})
</script>

<template>
  <div class="outline-panel">
    <div class="root-label">
      <Icon icon="mdi:cube-outline" :width="14" :height="14" class="root-icon" />
      电气室模型
    </div>

    <div v-for="group in groups" :key="group.key" class="group">
      <button type="button" class="group-head" @click="collapsed[group.key] = !collapsed[group.key]">
        <Icon
          :icon="collapsed[group.key] ? 'mdi:chevron-right' : 'mdi:chevron-down'"
          :width="14"
          :height="14"
        />
        <span>{{ group.label }}</span>
      </button>

      <ul v-show="!collapsed[group.key]" class="tree">
        <li v-for="node in group.nodes" :key="node.id">
          <div
            class="row"
            :class="{ active: selectedId === node.id }"
            @click="emit('select', node.id)"
          >
            <span class="name">{{ node.name }}</span>
            <button
              type="button"
              class="eye"
              @click.stop="emit('toggle-visible', node.id, !node.visible)"
            >
              <Icon
                :icon="node.visible ? 'mdi:eye-outline' : 'mdi:eye-off-outline'"
                :width="14"
                :height="14"
              />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="!nodes.length" class="empty">暂无节点</div>
  </div>
</template>

<style scoped>
.outline-panel {
  padding: 2px 6px 8px;
}

.root-label {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

.root-icon {
  color: var(--accent);
}

.group-head {
  width: 100%;
  height: 26px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.tree {
  list-style: none;
  margin: 0;
  padding: 0 0 4px;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 18px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 12px;
}

.row:hover {
  background: var(--bg-hover);
}

.row.active {
  background: var(--accent);
  color: #fff;
}

.row.active .eye {
  color: rgba(255, 255, 255, 0.85);
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eye {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0;
}

.empty {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
