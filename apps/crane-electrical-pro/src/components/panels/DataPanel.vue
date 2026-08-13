<script setup lang="ts">
defineProps<{
  selectedId: string
  propsJson: string
  deviceRows?: Array<{
    code: string
    name: string
    status: string
  }>
}>()

const placeholderTelemetry = [
  { label: '总线电压', value: '380.0 V', trend: 'stable' },
  { label: '总线电流', value: '—', trend: 'idle' },
  { label: '平均柜温', value: '—', trend: 'idle' },
  { label: '功率因数', value: '—', trend: 'idle' }
]
</script>

<template>
  <div class="data-panel">
    <section class="section">
      <div class="title">遥测摘要（编辑态占位）</div>
      <div class="metrics">
        <div v-for="row in placeholderTelemetry" :key="row.label" class="metric">
          <div class="m-label">{{ row.label }}</div>
          <div class="m-value">{{ row.value }}</div>
        </div>
      </div>
      <p class="hint">实时曲线在 /runtime 展示；此处仅结构占位。</p>
    </section>

    <section class="section">
      <div class="title">设备清单</div>
      <ul v-if="deviceRows?.length" class="list">
        <li v-for="d in deviceRows" :key="d.code" class="row">
          <span class="code">#{{ d.code }}</span>
          <span class="name">{{ d.name }}</span>
          <span class="status" :data-s="d.status">{{ d.status }}</span>
        </li>
      </ul>
      <div v-else class="empty">暂无带 deviceCode 的电柜</div>
    </section>

    <section class="section">
      <div class="title">选中节点 props</div>
      <pre v-if="selectedId" class="code">{{ propsJson }}</pre>
      <div v-else class="empty">选中设备后显示业务 props</div>
    </section>
  </div>
</template>

<style scoped>
.data-panel {
  padding: 12px;
}

.section {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.metric {
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
}

.m-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.m-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  gap: 8px;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
}

.row:nth-child(odd) {
  background: rgba(255, 255, 255, 0.02);
}

.code {
  color: var(--text-muted);
}

.name {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  color: var(--success);
  text-transform: uppercase;
  font-size: 11px;
}

.status[data-s='warning'] {
  color: var(--warning);
}

.status[data-s='fault'],
.status[data-s='alarm'] {
  color: var(--danger);
}

.code-block,
.code {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--info);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow: auto;
}

.empty {
  padding: 16px 8px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
