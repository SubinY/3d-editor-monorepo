<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createEmptyDocumentJSON } from '@3d-editor/editor'
import type { EditorDocumentJSON } from '@3d-editor/editor'
import { DEFAULT_CABINET_BOUNDS } from '@/business/catalog'
import { createDemoSceneJSON } from '@/business/demo-scene'
import { deleteDocument, listEntries, saveDocument, type DocumentEntry } from '@/business/storage'

const router = useRouter()
const version = ref(0)

const cabinets = computed<DocumentEntry[]>(() => {
  void version.value
  return listEntries('container')
})
const rooms = computed<DocumentEntry[]>(() => {
  void version.value
  return listEntries('scene')
})

// -- 创建表单 -----------------------------------------------------------------

type CreateKind = 'container' | 'scene' | null
const creating = ref<CreateKind>(null)

const cabinetForm = reactive({ name: '', ...DEFAULT_CABINET_BOUNDS })
const roomForm = reactive({ name: '', location: '' })

function openCreate(kind: Exclude<CreateKind, null>) {
  creating.value = kind
  cabinetForm.name = `电柜 ${cabinets.value.length + 1}`
  Object.assign(cabinetForm, DEFAULT_CABINET_BOUNDS)
  roomForm.name = `电柜室 ${rooms.value.length + 1}`
  roomForm.location = ''
}

function newDocumentJSON(kind: 'container' | 'scene'): EditorDocumentJSON {
  if (kind === 'container') {
    return createEmptyDocumentJSON({
      kind,
      id: `${kind}-${Date.now().toString(36)}`,
      name: cabinetForm.name || '未命名电柜',
      bounds: {
        width: cabinetForm.width || 0.8,
        depth: cabinetForm.depth || 0.6,
        height: cabinetForm.height || 2
      }
    })
  }
  return createEmptyDocumentJSON({
    kind,
    id: `${kind}-${Date.now().toString(36)}`,
    name: roomForm.name || '未命名电柜室',
    bounds: { width: 20, depth: 15, height: 3 },
    metadata: roomForm.location ? { location: roomForm.location } : undefined
  })
}

function submitCreate() {
  if (!creating.value) return
  const json = newDocumentJSON(creating.value)
  saveDocument(json)
  router.push(`/edit/${json.kind}/${json.id}`)
}

async function createDemo() {
  const json = await createDemoSceneJSON()
  saveDocument(json)
  version.value++
}

function remove(entry: DocumentEntry) {
  if (!window.confirm(`删除「${entry.json.name}」？`)) return
  deleteDocument(entry.json.id)
  version.value++
}

function boundsLabel(json: EditorDocumentJSON): string {
  const { width, depth, height } = json.bounds
  return height ? `${width} × ${depth} × ${height} m` : `${width} × ${depth} m`
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="home">
    <header class="hero">
      <div class="brand">
        <span class="logo">◧</span>
        <div>
          <h1>电柜室设计台</h1>
          <p>基于 @3d-editor/editor · 2D 画墙 / 拖放布柜 / 3D 同步预览</p>
        </div>
      </div>
      <button class="ghost" @click="createDemo">生成示例电柜室</button>
    </header>

    <main class="columns">
      <!-- 电柜 -->
      <section class="col">
        <div class="col-head">
          <h2>电柜</h2>
          <button class="primary" @click="openCreate('container')">＋ 创建电柜</button>
        </div>
        <p class="col-desc">定义柜体尺寸，在立体平面内布置元器件；保存后自动发布为场景侧柜资产。</p>
        <div v-if="!cabinets.length" class="empty">暂无电柜，点击右上角创建</div>
        <article v-for="entry in cabinets" :key="entry.json.id" class="card">
          <div class="card-main" @click="router.push(`/edit/container/${entry.json.id}`)">
            <span class="tag cabinet">柜</span>
            <div class="card-meta">
              <div class="card-name">{{ entry.json.name }}</div>
              <div class="card-sub">{{ boundsLabel(entry.json) }} · {{ entry.json.nodes.length }} 个元件 · {{ timeLabel(entry.updatedAt) }}</div>
            </div>
          </div>
          <div class="card-actions">
            <button @click="router.push(`/edit/container/${entry.json.id}`)">编辑</button>
            <button class="danger" @click="remove(entry)">删除</button>
          </div>
        </article>
      </section>

      <!-- 电柜室 -->
      <section class="col">
        <div class="col-head">
          <h2>电柜室</h2>
          <button class="primary" @click="openCreate('scene')">＋ 创建电柜室</button>
        </div>
        <p class="col-desc">空画布起步：2D 连续画墙圈出房间，拖入电柜与门窗柱，可进监控预览。</p>
        <div v-if="!rooms.length" class="empty">暂无电柜室，点击右上角创建（或先生成示例）</div>
        <article v-for="entry in rooms" :key="entry.json.id" class="card">
          <div class="card-main" @click="router.push(`/edit/scene/${entry.json.id}`)">
            <span class="tag room">室</span>
            <div class="card-meta">
              <div class="card-name">{{ entry.json.name }}</div>
              <div class="card-sub">
                {{ (entry.json.structure?.walls?.length ?? 0) }} 面墙 · {{ entry.json.nodes.length }} 台设备 · {{ timeLabel(entry.updatedAt) }}
              </div>
            </div>
          </div>
          <div class="card-actions">
            <button @click="router.push(`/edit/scene/${entry.json.id}`)">编辑</button>
            <button @click="router.push(`/preview/${entry.json.id}`)">预览</button>
            <button class="danger" @click="remove(entry)">删除</button>
          </div>
        </article>
      </section>
    </main>

    <!-- 创建弹窗 -->
    <div v-if="creating" class="modal-mask" @click.self="creating = null">
      <form class="modal" @submit.prevent="submitCreate">
        <h3>{{ creating === 'container' ? '创建电柜' : '创建电柜室' }}</h3>
        <template v-if="creating === 'container'">
          <label>名称<input v-model="cabinetForm.name" required /></label>
          <div class="row3">
            <label>宽 (m)<input v-model.number="cabinetForm.width" type="number" step="0.1" min="0.2" required /></label>
            <label>深 (m)<input v-model.number="cabinetForm.depth" type="number" step="0.1" min="0.2" required /></label>
            <label>高 (m)<input v-model.number="cabinetForm.height" type="number" step="0.1" min="0.5" required /></label>
          </div>
          <p class="hint">尺寸进入编辑器后仍可调整</p>
        </template>
        <template v-else>
          <label>名称<input v-model="roomForm.name" required /></label>
          <label>位置 / 备注<input v-model="roomForm.location" placeholder="选填，如 1# 配电房" /></label>
          <p class="hint">进入编辑器后用「画墙」工具圈出房间</p>
        </template>
        <div class="modal-actions">
          <button type="button" @click="creating = null">取消</button>
          <button type="submit" class="primary">创建并进入编辑器</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(1200px 500px at 70% -10%, rgba(31, 111, 235, 0.16), transparent 60%),
    radial-gradient(800px 400px at 10% 110%, rgba(57, 210, 255, 0.08), transparent 60%),
    #0b111b;
}
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1060px;
  margin: 0 auto;
  padding: 42px 24px 26px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  font-size: 40px;
  color: #39d2ff;
  line-height: 1;
}
h1 {
  margin: 0;
  font-size: 26px;
  letter-spacing: 1px;
}
.brand p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #6d8199;
}
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  max-width: 1060px;
  margin: 0 auto;
  padding: 0 24px 48px;
}
@media (max-width: 860px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
.col {
  background: rgba(16, 24, 35, 0.85);
  border: 1px solid #1c2a3c;
  border-radius: 10px;
  padding: 18px;
}
.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
  font-size: 17px;
}
.col-desc {
  font-size: 12px;
  color: #5d7188;
  margin: 8px 0 14px;
  line-height: 1.6;
}
.empty {
  padding: 26px 0;
  text-align: center;
  color: #44556b;
  font-size: 13px;
  border: 1px dashed #22314400;
}
.card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-bottom: 10px;
  background: #121c29;
  border: 1px solid #1f2f43;
  border-radius: 8px;
  transition: border-color 0.15s;
}
.card:hover {
  border-color: #2e639e;
}
.card-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.tag {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.tag.cabinet {
  background: rgba(63, 127, 191, 0.18);
  color: #6fb1e8;
}
.tag.room {
  background: rgba(63, 174, 138, 0.16);
  color: #52c79c;
}
.card-name {
  font-size: 14px;
  font-weight: 600;
}
.card-sub {
  font-size: 12px;
  color: #5d7188;
  margin-top: 2px;
}
.card-actions {
  display: flex;
  gap: 6px;
}
button {
  background: #1a2637;
  color: #cfe0f0;
  border: 1px solid #2c3e52;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}
button:hover {
  border-color: #3d5a7a;
}
button.primary {
  background: #1f6feb;
  border-color: #1f6feb;
  color: #fff;
}
button.ghost {
  background: transparent;
  border-color: #2c3e52;
  color: #8ea4bd;
}
button.danger {
  color: #ff8f8f;
  border-color: #4a2a2a;
  background: #221419;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 14, 0.66);
  display: grid;
  place-items: center;
  z-index: 20;
}
.modal {
  width: 380px;
  background: #101a27;
  border: 1px solid #24364d;
  border-radius: 10px;
  padding: 22px;
}
.modal h3 {
  margin: 0 0 16px;
}
label {
  display: block;
  font-size: 12px;
  color: #8ea4bd;
  margin-bottom: 12px;
}
input {
  width: 100%;
  margin-top: 4px;
  background: #16212e;
  color: #d5e0ec;
  border: 1px solid #2c3e52;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 13px;
}
.row3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.hint {
  font-size: 12px;
  color: #5d7188;
  margin: 0 0 12px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.modal-actions button {
  padding: 7px 16px;
}
</style>
