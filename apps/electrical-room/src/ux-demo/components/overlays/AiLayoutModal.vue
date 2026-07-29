<script setup lang="ts">
import { ref } from 'vue'
import { AI_LAYOUT_PLANS } from '../../mock-data'

const emit = defineEmits<{
  close: []
  apply: [planId: string]
}>()

const selected = ref('A')
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal">
      <header>
        <h3>AI 智能布局建议</h3>
        <button type="button" @click="emit('close')">×</button>
      </header>
      <div class="analysis">
        <div>✓ 通道净宽 ≥ 1200 毫米</div>
        <div>✓ 设备间距检测</div>
        <div>✓ 密度优化建议</div>
        <div>△ 风道热区分析（示意）</div>
      </div>
      <div class="plans">
        <button
          v-for="p in AI_LAYOUT_PLANS"
          :key="p.id"
          type="button"
          class="plan"
          :class="{ on: selected === p.id }"
          @click="selected = p.id"
        >
          <strong>{{ p.name }}</strong>
          <span>评分 {{ p.score }}</span>
          <p>{{ p.summary }}</p>
        </button>
        <div class="plan muted">
          <strong>当前布局</strong>
          <span>评分 76</span>
          <p>保留现状以便对比</p>
        </div>
      </div>
      <footer>
        <button type="button" class="ghost" @click="emit('close')">取消</button>
        <button type="button" class="primary" @click="emit('apply', selected)">一键应用方案</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: min(640px, 94vw);
  background: #0f1826;
  border: 1px solid #2a3c52;
  border-radius: 14px;
  padding: 16px 18px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
header h3 {
  margin: 0;
}
header button {
  border: 0;
  background: transparent;
  color: #8ea4bd;
  font-size: 22px;
  cursor: pointer;
}
.analysis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 14px 0;
  font-size: 12px;
  color: #9db0c5;
}
.analysis div {
  background: #121c2a;
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid #1e2e42;
}
.plans {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.plan {
  text-align: left;
  border: 1px solid #223247;
  background: #121c2a;
  border-radius: 10px;
  padding: 12px;
  color: #d7e4f2;
  cursor: pointer;
}
.plan.on {
  border-color: #1f6fff;
  box-shadow: 0 0 0 1px #1f6fff;
}
.plan.muted {
  opacity: 0.7;
  cursor: default;
}
.plan strong {
  display: block;
  font-size: 13px;
}
.plan span {
  color: #3dd6ff;
  font-size: 12px;
}
.plan p {
  margin: 6px 0 0;
  font-size: 11px;
  color: #6d8199;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.ghost,
.primary {
  border: 0;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}
.ghost {
  background: #152033;
  color: #c5d4e6;
}
.primary {
  background: #1f6fff;
  color: #fff;
}
@media (max-width: 700px) {
  .plans {
    grid-template-columns: 1fr;
  }
}
</style>
