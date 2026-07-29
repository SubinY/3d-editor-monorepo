<script setup lang="ts">
import type { MockNode } from '../../mock-data'

defineProps<{
  node: MockNode
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal">
      <header>
        <div>
          <h3>{{ node.name }} · 柜内</h3>
          <p>模拟复合资产 / 柜内立面（示意）</p>
        </div>
        <button type="button" @click="emit('close')">×</button>
      </header>
      <div class="body">
        <div class="cabinet">
          <div class="shell">
            <div
              v-for="c in node.interior || []"
              :key="c.id"
              class="comp"
              :style="{
                bottom: `${(c.y / node.h) * 100}%`,
                width: `${(c.w / node.w) * 70}%`,
                height: `${(c.h / node.h) * 80}%`,
                background: c.color
              }"
              :title="c.name"
            >
              {{ c.name }}
            </div>
            <div v-if="!node.interior?.length" class="empty">无柜内元件数据</div>
          </div>
        </div>
        <ul class="list">
          <li v-for="c in node.interior || []" :key="'l-' + c.id">
            <i :style="{ background: c.color }" />
            <div>
              <strong>{{ c.name }}</strong>
              <small>离地 {{ (c.y * 1000).toFixed(0) }} 毫米</small>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: min(860px, 94vw);
  height: min(560px, 88vh);
  background: #0f1826;
  border: 1px solid #2a3c52;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
}
header {
  display: flex;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #1c2a3d;
}
header h3 {
  margin: 0;
}
header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6d8199;
}
header button {
  border: 0;
  background: transparent;
  color: #8ea4bd;
  font-size: 22px;
  cursor: pointer;
}
.body {
  flex: 1;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  min-height: 0;
}
.cabinet {
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 50% 30%, #1a2738, #0a1018);
}
.shell {
  position: relative;
  width: 220px;
  height: 380px;
  border: 2px solid #4b5d72;
  border-radius: 8px;
  background: linear-gradient(180deg, #2a3544, #1a222c);
  box-shadow: inset 0 0 0 8px #151c26;
}
.comp {
  position: absolute;
  left: 50%;
  transform: translate(-50%, 50%);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 10px;
  color: #fff;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 2px;
  min-height: 24px;
}
.empty {
  height: 100%;
  display: grid;
  place-items: center;
  color: #6d8199;
  font-size: 12px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border-left: 1px solid #1c2a3d;
}
.list li {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: #121c2a;
  margin-bottom: 8px;
}
.list i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin-top: 4px;
}
.list strong {
  display: block;
  font-size: 13px;
}
.list small {
  color: #6d8199;
  font-size: 11px;
}
</style>
