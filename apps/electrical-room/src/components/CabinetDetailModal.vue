<script setup lang="ts">
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

export interface CabinetDeviceItem {
  id: string
  name: string
  icon: string
  statusTone: 'ok' | 'warn' | 'danger' | 'info'
  fields: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'danger' | 'info' }>
}

const props = defineProps<{
  modelValue: boolean
  cabinetName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const displayName = computed(() => props.cabinetName || '配电柜-08')

const updatedAt = '2026/07/29 10:38:01'

const leftDevices: CabinetDeviceItem[] = [
  {
    id: 'smoke',
    name: '烟雾传感器-01',
    icon: 'smoke',
    statusTone: 'ok',
    fields: [
      { label: '状态', value: '正常', tone: 'ok' },
      { label: '烟雾浓度', value: '2.0%' }
    ]
  },
  {
    id: 'alarm',
    name: '声光报警器-01',
    icon: 'siren',
    statusTone: 'ok',
    fields: [
      { label: '状态', value: '待命', tone: 'info' },
      { label: '告警次数', value: '1次' }
    ]
  },
  {
    id: 'vibration',
    name: '振动传感器-01',
    icon: 'wave',
    statusTone: 'danger',
    fields: [
      { label: '状态', value: '异常', tone: 'danger' },
      { label: '振动值', value: '0.07g' }
    ]
  },
  {
    id: 'door',
    name: '门禁-01',
    icon: 'door',
    statusTone: 'info',
    fields: [{ label: '门禁状态', value: '关闭', tone: 'info' }]
  },
  {
    id: 'pdu',
    name: '智能PDU-01',
    icon: 'pdu',
    statusTone: 'danger',
    fields: [
      { label: '电压', value: '220V' },
      { label: '功率', value: '12.7kWh' },
      { label: '电流', value: '21.5A' }
    ]
  },
  {
    id: 'th',
    name: '温湿度传感器-01',
    icon: 'temp',
    statusTone: 'danger',
    fields: [
      { label: '温度', value: '104.3℃', tone: 'danger' },
      { label: '湿度', value: '61%' }
    ]
  }
]

const rightDevices: CabinetDeviceItem[] = [
  {
    id: 'leak',
    name: '漏水检测器-01',
    icon: 'drop',
    statusTone: 'ok',
    fields: [{ label: '漏水状态', value: '正常', tone: 'ok' }]
  },
  {
    id: 'ups',
    name: 'UPS-01',
    icon: 'ups',
    statusTone: 'ok',
    fields: [
      { label: '运行状态', value: '市电', tone: 'ok' },
      { label: '环境温度', value: '25℃' },
      { label: '剩余电量', value: '79%' }
    ]
  },
  {
    id: 'ac',
    name: '精密空调-01',
    icon: 'ac',
    statusTone: 'ok',
    fields: [
      { label: '设定温度', value: '20℃' },
      { label: '回风温度', value: '23℃' },
      { label: '设定湿度', value: '65%' },
      { label: '回风湿度', value: '70%' }
    ]
  },
  {
    id: 'meter',
    name: '智能电表-01',
    icon: 'meter',
    statusTone: 'danger',
    fields: [
      { label: '电压', value: '220V' },
      { label: '电流', value: '21.5A' },
      { label: '功率', value: '19.3kW' },
      { label: '累计电量', value: '8kWh' }
    ]
  },
  {
    id: 'light',
    name: '柜内照明-01',
    icon: 'light',
    statusTone: 'ok',
    fields: [{ label: '状态', value: '开启', tone: 'ok' }]
  }
]

function close() {
  visible.value = false
}

function onHistory() {
  ElMessage.info('历史告警（假数据示意）')
}

function onTrend() {
  ElMessage.info('趋势曲线（假数据示意）')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="1080px"
    align-center
    append-to-body
    :show-close="false"
    class="cabinet-detail-dialog"
    modal-class="cabinet-detail-overlay"
  >
    <div class="panel">
      <header class="head">
        <div class="title">
          <span class="title-mark" />
          机柜设备详情
        </div>
        <button type="button" class="close-btn" aria-label="关闭" @click="close">
          <el-icon :size="16"><Close /></el-icon>
        </button>
      </header>

      <div class="meta">
        <div class="meta-item">
          <span class="meta-icon rack" />
          <span class="meta-label">设备名称:</span>
          <strong>{{ displayName }}</strong>
        </div>
        <div class="meta-item">
          <span class="meta-label">告警状态:</span>
          <i class="alarm-dot" />
        </div>
        <div class="meta-item">
          <span class="online-ring" />
          <span class="meta-label">在线状态:</span>
          <strong class="online">在线</strong>
        </div>
        <div class="meta-item">
          <span class="clock" />
          <span class="meta-label">最近更新时间:</span>
          <strong>{{ updatedAt }}</strong>
        </div>
      </div>

      <div class="body">
        <div class="col">
          <article
            v-for="item in leftDevices"
            :key="item.id"
            class="device"
            :class="item.statusTone"
          >
            <div class="device-icon" :data-icon="item.icon" />
            <div class="device-main">
              <h4>{{ item.name }}</h4>
              <p>
                <template v-for="(field, i) in item.fields" :key="field.label">
                  <span v-if="i > 0" class="sep"> </span>
                  <span class="field-label">{{ field.label }}:</span>
                  <span class="field-value" :class="field.tone">{{ field.value }}</span>
                </template>
              </p>
            </div>
          </article>
        </div>

        <div class="hero">
          <div class="hero-glow" />
          <div class="cabinet-art" aria-hidden="true">
            <div class="cab-body">
              <div class="cab-door left-door" />
              <div class="cab-inner">
                <div v-for="n in 8" :key="n" class="rack-u" />
              </div>
              <div class="cab-door right-door open" />
            </div>
            <div class="cab-base" />
          </div>
        </div>

        <div class="col">
          <article
            v-for="item in rightDevices"
            :key="item.id"
            class="device"
            :class="item.statusTone"
          >
            <div class="device-icon" :data-icon="item.icon" />
            <div class="device-main">
              <h4>{{ item.name }}</h4>
              <p>
                <template v-for="(field, i) in item.fields" :key="field.label">
                  <span v-if="i > 0" class="sep"> </span>
                  <span class="field-label">{{ field.label }}:</span>
                  <span class="field-value" :class="field.tone">{{ field.value }}</span>
                </template>
              </p>
            </div>
          </article>
        </div>
      </div>

      <footer class="foot">
        <button type="button" class="btn danger" @click="onHistory">查看历史告警</button>
        <button type="button" class="btn primary" @click="onTrend">查看趋势曲线</button>
        <button type="button" class="btn ghost" @click="close">关闭</button>
      </footer>
    </div>
  </el-dialog>
</template>

<style scoped>
.panel {
  --line: rgba(45, 140, 220, 0.45);
  --panel: rgba(6, 22, 40, 0.92);
  --card: rgba(10, 36, 62, 0.72);
  --text: #d7eafc;
  --muted: #7fa3c2;
  --cyan: #3ec8ff;
  --ok: #2ee6a6;
  --danger: #ff4d5e;
  --warn: #ffb020;
  color: var(--text);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: 1px;
  color: var(--cyan);
  text-shadow: 0 0 18px rgba(62, 200, 255, 0.35);
}

.title-mark {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, #5de1ff, #1a7dff);
  box-shadow: 0 0 10px rgba(62, 200, 255, 0.8);
}

.close-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(62, 200, 255, 0.35);
  border-radius: 4px;
  background: rgba(8, 28, 48, 0.8);
  color: var(--cyan);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.close-btn:hover {
  background: rgba(20, 60, 96, 0.9);
}

.meta {
  display: grid;
  grid-template-columns: 1.3fr 0.9fr 1fr 1.4fr;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(12, 40, 68, 0.85), rgba(8, 26, 46, 0.85));
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  min-width: 0;
}

.meta-label {
  color: var(--muted);
  white-space: nowrap;
}

.meta-item strong {
  color: #e8f6ff;
  font-weight: 600;
}

.meta-item .online {
  color: var(--ok);
}

.alarm-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 10px rgba(255, 77, 94, 0.9);
}

.online-ring {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--ok);
  box-shadow: 0 0 8px rgba(46, 230, 166, 0.55);
  position: relative;
}

.online-ring::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: var(--ok);
}

.meta-icon.rack,
.clock {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--cyan);
  border-radius: 2px;
  opacity: 0.85;
  flex-shrink: 0;
}

.clock {
  border-radius: 50%;
  position: relative;
}

.clock::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 3px;
  width: 1.5px;
  height: 5px;
  background: var(--cyan);
}

.body {
  display: grid;
  grid-template-columns: 1fr minmax(260px, 320px) 1fr;
  gap: 16px;
  align-items: stretch;
  min-height: 420px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(48, 120, 180, 0.35);
  background: var(--card);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.device.danger {
  border-color: rgba(255, 77, 94, 0.55);
  box-shadow: 0 0 0 1px rgba(255, 77, 94, 0.12), inset 0 0 20px rgba(255, 60, 80, 0.06);
}

.device.ok {
  border-color: rgba(46, 230, 166, 0.28);
}

.device.info {
  border-color: rgba(62, 200, 255, 0.35);
}

.device-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  flex-shrink: 0;
  background:
    linear-gradient(135deg, rgba(62, 200, 255, 0.35), rgba(20, 80, 140, 0.2)),
    rgba(8, 30, 52, 0.9);
  border: 1px solid rgba(62, 200, 255, 0.35);
  position: relative;
}

.device-icon::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px solid var(--cyan);
  border-radius: 3px;
  opacity: 0.9;
}

.device.danger .device-icon {
  border-color: rgba(255, 77, 94, 0.55);
  background: linear-gradient(135deg, rgba(255, 77, 94, 0.28), rgba(80, 20, 30, 0.2));
}

.device.danger .device-icon::after {
  border-color: var(--danger);
}

.device-main {
  min-width: 0;
  flex: 1;
}

.device-main h4 {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 650;
  color: #eaf6ff;
}

.device-main p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
}

.field-label {
  margin-right: 2px;
}

.field-value {
  margin-right: 10px;
  color: #cfe6f8;
}

.field-value.ok {
  color: var(--ok);
}

.field-value.danger {
  color: var(--danger);
}

.field-value.info {
  color: var(--cyan);
}

.field-value.warn {
  color: var(--warn);
}

.hero {
  position: relative;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid rgba(45, 140, 220, 0.3);
  background:
    radial-gradient(circle at 50% 45%, rgba(40, 120, 200, 0.22), transparent 55%),
    linear-gradient(180deg, rgba(8, 28, 48, 0.4), rgba(4, 14, 28, 0.7));
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  width: 70%;
  height: 70%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(40, 160, 255, 0.22), transparent 70%);
  filter: blur(8px);
}

.cabinet-art {
  position: relative;
  z-index: 1;
  width: 170px;
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cab-body {
  position: relative;
  width: 140px;
  flex: 1;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(180deg, #1a2a3d, #0d1724);
  border: 2px solid #2a4d6e;
  box-shadow:
    0 0 24px rgba(40, 140, 255, 0.35),
    inset 0 0 0 2px rgba(50, 160, 255, 0.25);
  display: flex;
  overflow: hidden;
}

.cab-inner {
  flex: 1;
  margin: 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rack-u {
  flex: 1;
  border-radius: 2px;
  background: linear-gradient(90deg, #1e3a2a, #2a5a40 40%, #143020);
  box-shadow: inset 0 0 0 1px rgba(80, 200, 140, 0.25);
  position: relative;
}

.rack-u::before,
.rack-u::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translateY(-50%);
  background: #3dff9a;
  box-shadow: 0 0 6px #3dff9a;
}

.rack-u::before {
  left: 8px;
}

.rack-u::after {
  right: 8px;
  background: #ffb020;
  box-shadow: 0 0 6px #ffb020;
}

.cab-door {
  width: 18px;
  background: linear-gradient(180deg, #243448, #121c28);
  border-right: 1px solid #3a5f80;
}

.cab-door.right-door {
  border-right: none;
  border-left: 1px solid #3a5f80;
}

.cab-door.open {
  width: 28px;
  transform: perspective(200px) rotateY(-28deg);
  transform-origin: left center;
  background: linear-gradient(180deg, #2a4058, #152030);
  box-shadow: 8px 0 16px rgba(0, 0, 0, 0.35);
}

.cab-base {
  width: 150px;
  height: 10px;
  margin-top: 4px;
  border-radius: 2px;
  background: #0a1420;
  border: 1px solid #2a4d6e;
}

.foot {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 18px;
  padding-top: 4px;
}

.btn {
  min-width: 140px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.btn.danger {
  color: #fff;
  background: linear-gradient(180deg, #e24a5a, #b22236);
  border-color: rgba(255, 120, 130, 0.35);
  box-shadow: 0 0 14px rgba(220, 60, 80, 0.35);
}

.btn.primary {
  color: #fff;
  background: linear-gradient(180deg, #2f7dff, #1a55c8);
  border-color: rgba(120, 180, 255, 0.4);
  box-shadow: 0 0 14px rgba(40, 120, 255, 0.35);
}

.btn.ghost {
  color: #d7eafc;
  background: rgba(16, 40, 68, 0.85);
  border-color: rgba(70, 130, 180, 0.45);
}

.btn:hover {
  filter: brightness(1.08);
}

@media (max-width: 1100px) {
  .meta {
    grid-template-columns: 1fr 1fr;
  }
  .body {
    grid-template-columns: 1fr;
  }
  .hero {
    min-height: 280px;
    order: -1;
  }
}
</style>

<style>
.cabinet-detail-overlay {
  background: rgba(2, 10, 20, 0.72) !important;
  backdrop-filter: blur(2px);
}

.cabinet-detail-dialog.el-dialog {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

.cabinet-detail-dialog .el-dialog__header {
  display: none;
}

.cabinet-detail-dialog .el-dialog__body {
  padding: 18px 20px 20px;
  border-radius: 12px;
  border: 1px solid rgba(50, 150, 230, 0.55);
  background:
    linear-gradient(180deg, rgba(8, 32, 56, 0.96), rgba(4, 16, 32, 0.98)),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 31px,
      rgba(40, 120, 180, 0.05) 32px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 31px,
      rgba(40, 120, 180, 0.05) 32px
    );
  box-shadow:
    0 0 0 1px rgba(62, 200, 255, 0.12),
    0 20px 60px rgba(0, 0, 0, 0.55),
    inset 0 0 40px rgba(30, 100, 180, 0.08);
}
</style>
