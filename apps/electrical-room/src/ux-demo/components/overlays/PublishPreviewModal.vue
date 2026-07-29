<script setup lang="ts">
import { ref } from 'vue'
import { PUBLISH_CHECKS } from '../../mock-data'

const props = defineProps<{
  mode: 'publish' | 'runtime'
}>()

const emit = defineEmits<{
  close: []
  published: []
  'open-runtime': []
}>()

const done = ref(false)

function publish() {
  done.value = true
  emit('published')
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal">
      <header>
        <h3>{{ mode === 'runtime' ? '运行时预览' : '发布与预览' }}</h3>
        <button type="button" @click="emit('close')">×</button>
      </header>

      <template v-if="mode === 'publish' && !done">
        <ul class="checks">
          <li v-for="c in PUBLISH_CHECKS" :key="c.id">
            <span class="ok">✓</span>
            <div>
              <strong>{{ c.label }}</strong>
              <small>{{ c.detail }}</small>
            </div>
          </li>
        </ul>
        <footer>
          <button type="button" class="ghost" @click="emit('close')">取消</button>
          <button type="button" class="primary" @click="publish">发布场景</button>
        </footer>
      </template>

      <template v-else>
        <div class="runtime">
          <div class="scene-ph">发布快照运行时（示意）</div>
          <div class="stats">
            <div><em>温度</em><strong>32.5°C</strong></div>
            <div><em>湿度</em><strong>45%RH</strong></div>
            <div><em>功率</em><strong>12.6 kW</strong></div>
            <div class="alarm"><em>告警</em><strong>正常</strong></div>
          </div>
          <div class="scenes">
            <button type="button" class="on">场景 1</button>
            <button type="button">场景 2</button>
            <button type="button">场景 3</button>
          </div>
        </div>
        <footer>
          <button type="button" class="ghost" @click="emit('close')">关闭</button>
          <button
            v-if="mode === 'publish'"
            type="button"
            class="primary"
            @click="emit('open-runtime')"
          >
            进入运行时
          </button>
        </footer>
      </template>
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
  width: min(520px, 94vw);
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
.checks {
  list-style: none;
  margin: 14px 0;
  padding: 0;
}
.checks li {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: #121c2a;
  margin-bottom: 8px;
}
.ok {
  color: #22c55e;
}
.checks strong {
  display: block;
  font-size: 13px;
}
.checks small {
  color: #6d8199;
  font-size: 11px;
}
.runtime .scene-ph {
  height: 160px;
  border-radius: 10px;
  background: radial-gradient(circle at 40% 30%, #2a3a4e, #0c1420);
  display: grid;
  place-items: center;
  color: #7b90a8;
  margin: 12px 0;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.stats div {
  background: #121c2a;
  border-radius: 8px;
  padding: 8px;
  text-align: center;
}
.stats em {
  display: block;
  font-style: normal;
  font-size: 10px;
  color: #6d8199;
}
.stats strong {
  font-size: 14px;
}
.alarm strong {
  color: #22c55e;
}
.scenes {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}
.scenes button {
  flex: 1;
  border: 1px solid #223247;
  background: #152033;
  color: #8ea4bd;
  border-radius: 7px;
  padding: 7px;
  cursor: pointer;
}
.scenes button.on {
  border-color: #1f6fff;
  color: #fff;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
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
</style>
