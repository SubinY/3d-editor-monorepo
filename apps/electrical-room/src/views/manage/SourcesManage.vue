<script setup lang="ts">
import CommPanel from '@/components/workbench/CommPanel.vue'
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1>数据源</h1>
        <p>可供绑定的源和点位，不自动连网。预览时按场景实际绑定按需建连。</p>
      </div>
    </header>
    <div class="panel">
      <CommPanel />
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 28px 32px 40px;
  min-height: 100%;
  background:
    radial-gradient(900px 420px at 85% -10%, rgba(61, 214, 255, 0.1), transparent 55%),
    #0b111b;
}
.head {
  margin-bottom: 18px;
}
h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.5px;
}
.head p {
  margin: 6px 0 0;
  color: #6d8199;
  font-size: 13px;
}
.panel {
  max-width: 640px;
  background: #101a27;
  border: 1px solid #1d2c3e;
  border-radius: 10px;
  overflow: hidden;
}
</style>
