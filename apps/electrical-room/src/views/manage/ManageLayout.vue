<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Monitor, OfficeBuilding, Box, Connection } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const active = computed(() => {
  if (route.path.startsWith('/manage/cabinets')) return 'cabinets'
  if (route.path.startsWith('/manage/sources')) return 'sources'
  return 'rooms'
})

function go(name: string) {
  if (name === 'cabinets') router.push('/manage/cabinets')
  else if (name === 'sources') router.push('/manage/sources')
  else router.push('/manage/rooms')
}
</script>

<template>
  <div class="shell">
    <aside class="rail">
      <div class="brand" @click="go('rooms')">
        <span class="mark">ER</span>
        <div>
          <div class="title">电气室管控</div>
          <div class="sub">电柜室 · 电柜 · 预览</div>
        </div>
      </div>
      <nav class="nav">
        <button :class="{ active: active === 'rooms' }" type="button" @click="go('rooms')">
          <el-icon><OfficeBuilding /></el-icon>
          电柜室管理
        </button>
        <button :class="{ active: active === 'cabinets' }" type="button" @click="go('cabinets')">
          <el-icon><Box /></el-icon>
          电柜管理
        </button>
        <button :class="{ active: active === 'sources' }" type="button" @click="go('sources')">
          <el-icon><Connection /></el-icon>
          数据源
        </button>
      </nav>
      <div class="rail-foot">
        <el-icon><Monitor /></el-icon>
        <span>@mh/3d-editor</span>
      </div>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
  background: #070d16;
  color: #d7e4f2;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.rail {
  width: 220px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #0d1624 0%, #0a121c 100%);
  border-right: 1px solid #1a2a3d;
  display: flex;
  flex-direction: column;
  padding: 18px 12px;
}
.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 10px 20px;
  cursor: pointer;
}
.mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #041018;
  background: linear-gradient(135deg, #3dd6ff, #1f8fff);
}
.title {
  font-size: 15px;
  font-weight: 650;
}
.sub {
  font-size: 11px;
  color: #6d8199;
  margin-top: 2px;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  color: #8ea4bd;
  padding: 11px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.nav button:hover {
  background: rgba(61, 214, 255, 0.06);
  color: #d7e4f2;
}
.nav button.active {
  background: rgba(31, 143, 255, 0.16);
  color: #e8f4ff;
  box-shadow: inset 2px 0 0 #3dd6ff;
}
.rail-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4d6076;
  font-size: 11px;
  padding: 10px;
}
.main {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
</style>
