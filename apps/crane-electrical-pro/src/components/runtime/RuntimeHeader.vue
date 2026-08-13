<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useRuntimeStore } from '@/stores/runtime'

const emit = defineEmits<{
  'toggle-alarms': []
  'reset-view': []
}>()

const router = useRouter()
const runtime = useRuntimeStore()
const { statusSummary, alarms } = storeToRefs(runtime)
</script>

<template>
  <header class="runtime-header">
    <div class="brand">
      <div class="logo">
        <Icon icon="mdi:crane" :width="22" :height="22" />
      </div>
      <div>
        <div class="title">起重机电气室监控</div>
        <div class="sub">10m × 5m × 2m 矩形空间 | 数字孪生模型</div>
      </div>
    </div>

    <div class="summary">
      <div class="badge">
        <Icon
          :icon="statusSummary.systemOk ? 'mdi:shield-check' : 'mdi:shield-alert'"
          :width="18"
          :height="18"
          :class="statusSummary.systemOk ? 'ok' : 'bad'"
        />
        <div>
          <div class="k">系统状态</div>
          <div class="v">{{ statusSummary.systemOk ? '正常' : '异常' }}</div>
        </div>
      </div>
      <div class="badge">
        <Icon icon="mdi:check-circle" class="ok" :width="18" :height="18" />
        <div>
          <div class="k">正常设备</div>
          <div class="v">{{ statusSummary.normal }}</div>
        </div>
      </div>
      <div class="badge warn-dot">
        <Icon icon="mdi:alert" class="bad" :width="18" :height="18" />
        <div>
          <div class="k">报警设备</div>
          <div class="v">{{ statusSummary.alarm }}</div>
        </div>
      </div>
      <div class="badge">
        <Icon icon="mdi:alert-circle-outline" class="warn" :width="18" :height="18" />
        <div>
          <div class="k">预警设备</div>
          <div class="v">{{ statusSummary.warning }}</div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button type="button" class="btn primary" @click="emit('reset-view')">
        <Icon icon="mdi:refresh" :width="16" :height="16" />
        视图复位
      </button>
      <button type="button" class="btn danger" @click="emit('toggle-alarms')">
        <Icon icon="mdi:bell-outline" :width="16" :height="16" />
        报警列表 {{ alarms.length }}
      </button>
      <button type="button" class="btn ghost" @click="router.push('/editor')">
        <Icon icon="mdi:pencil-ruler" :width="16" :height="16" />
        编辑
      </button>
    </div>
  </header>
</template>

<style scoped>
.runtime-header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--accent-dim);
  color: var(--accent);
  display: grid;
  place-items: center;
}

.title {
  font-size: 15px;
  font-weight: 700;
}

.sub {
  font-size: 11px;
  color: var(--text-muted);
}

.summary {
  display: flex;
  gap: 10px;
}

.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 110px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  position: relative;
}

.badge .k {
  font-size: 10px;
  color: var(--text-muted);
}

.badge .v {
  font-size: 14px;
  font-weight: 700;
}

.ok {
  color: var(--success);
}
.warn {
  color: var(--warning);
}
.bad {
  color: var(--danger);
}

.warn-dot::after {
  content: '';
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--danger);
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  background: transparent;
}

.btn.primary {
  border: 1px solid var(--accent);
  color: var(--accent);
}

.btn.danger {
  border: 1px solid var(--danger);
  color: var(--danger);
}

.btn.ghost {
  border: 1px solid var(--border-strong);
  color: var(--text-secondary);
}
</style>
