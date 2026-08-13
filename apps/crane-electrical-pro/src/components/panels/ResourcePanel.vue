<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { CatalogItem } from '@mh/3d-editor'
import { EQUIPMENT_ITEMS, FIXTURE_ITEMS, OVERLAY_ITEMS } from '@/catalog'

export type ResourceCard = {
  id: string
  name: string
  sub?: string
  icon: string
  thumb: string
  placeable: boolean
  item?: CatalogItem
}

const emit = defineEmits<{
  'drag-start': [event: DragEvent, item: CatalogItem]
  'drag-end': []
}>()

const query = ref('')

const PLACEHOLDER_EQUIPMENT: ResourceCard[] = [
  { id: 'ui-cab-body', name: '柜体', sub: '电气柜', icon: 'mdi:archive', thumb: '#3B82F6', placeable: false },
  { id: 'ui-cab-ups', name: 'UPS 柜', sub: '后备电源', icon: 'mdi:battery-charging', thumb: '#F59E0B', placeable: false }
]

const PLACEHOLDER_FIXTURE: ResourceCard[] = [
  { id: 'ui-emerg', name: '应急灯', sub: '壁挂', icon: 'mdi:wall-sconce-flat', thumb: '#FBBF24', placeable: false }
]

function toCard(item: CatalogItem): ResourceCard {
  const icon =
    item.kind === 'door'
      ? 'mdi:door'
      : item.kind === 'light'
        ? 'mdi:ceiling-light'
        : item.kind === 'camera'
          ? 'mdi:cctv'
          : item.kind === 'panel'
            ? 'mdi:card-text-outline'
            : item.kind === 'glow-ring'
              ? 'mdi:circle-outline'
              : item.kind === 'alert-box'
                ? 'mdi:alert-box-outline'
                : 'mdi:archive'
  const sub =
    item.id === 'cab-lv'
      ? '低压'
      : item.id === 'cab-ctrl'
        ? 'PLC'
        : item.kind === 'light'
          ? '吸顶'
          : item.kind === 'camera'
            ? '半球'
            : item.kind === 'door'
              ? '平开'
              : item.kind === 'panel'
                ? 'Sprite'
                : item.kind === 'glow-ring'
                  ? '贴地'
                  : item.kind === 'alert-box'
                    ? '告警'
                    : undefined
  return {
    id: item.id,
    name: item.name.replace('低压电柜', '配电柜').replace('控制柜', '控制柜'),
    sub,
    icon,
    thumb: item.thumb || '#3B82F6',
    placeable: true,
    item
  }
}

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const match = (c: ResourceCard) =>
    !q || c.name.toLowerCase().includes(q) || (c.sub || '').toLowerCase().includes(q)

  return [
    {
      key: 'equipment',
      label: '电气设备',
      items: [...EQUIPMENT_ITEMS.map(toCard), ...PLACEHOLDER_EQUIPMENT].filter(match)
    },
    {
      key: 'fixture',
      label: '照明与安防',
      items: [...FIXTURE_ITEMS.filter(i => i.kind !== 'door' && i.kind !== 'panel').map(toCard), ...PLACEHOLDER_FIXTURE].filter(
        match
      )
    },
    {
      key: 'overlay',
      label: '标注与特效',
      items: OVERLAY_ITEMS.map(toCard).filter(match)
    }
  ]
})

function onDragStart(event: DragEvent, card: ResourceCard) {
  if (!card.placeable || !card.item) {
    event.preventDefault()
    return
  }
  emit('drag-start', event, card.item)
}
</script>

<template>
  <div class="resource-panel">
    <div class="search">
      <Icon icon="mdi:magnify" :width="14" :height="14" class="search-icon" />
      <input v-model="query" type="search" placeholder="搜索资源" />
    </div>

    <section v-for="group in groups" :key="group.key" class="group">
      <div class="group-title">{{ group.label }}</div>
      <div class="grid">
        <div
          v-for="card in group.items"
          :key="card.id"
          class="card"
          :class="{ disabled: !card.placeable }"
          :draggable="card.placeable"
          :title="card.placeable ? '拖到 2D 放置' : 'UI 占位'"
          @dragstart="onDragStart($event, card)"
          @dragend="emit('drag-end')"
        >
          <div class="thumb" :style="{ background: card.thumb }">
            <Icon :icon="card.icon" :width="20" :height="20" />
          </div>
          <div class="meta">
            <div class="label">{{ card.name }}</div>
            <div v-if="card.sub" class="sub">({{ card.sub }})</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.resource-panel {
  padding: 8px 10px 10px;
}

.search {
  position: relative;
  margin-bottom: 10px;
}

.search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search input {
  width: 100%;
  height: 28px;
  padding: 0 8px 0 28px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 12px;
}

.group + .group {
  margin-top: 12px;
}

.group-title {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 6px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  cursor: grab;
  user-select: none;
}

.card:hover:not(.disabled) {
  border-color: var(--accent);
}

.card.disabled {
  cursor: default;
  opacity: 0.75;
}

.thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: #fff;
}

.meta {
  text-align: center;
  line-height: 1.25;
}

.label {
  font-size: 12px;
  color: var(--text-primary);
}

.sub {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
