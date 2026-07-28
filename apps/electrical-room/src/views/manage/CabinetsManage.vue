<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createEmptyDocumentJSON } from '@3d-editor/editor'
import type { CatalogItem, EditorDocumentJSON } from '@3d-editor/editor'
import {
  DEFAULT_CABINET_BOUNDS,
  INITIAL_CABINET_VERSION,
  cabinetCatalogId,
  setEditingVersion
} from '@/business/catalog'
import * as api from '@/business/api'
import type { DocumentRecord } from '@/business/api'

interface CabinetRow {
  id: string
  catalogId: string
  name: string
  size: string
  nodes: number
  latestVersion: string
  versions: string[]
  updatedAt: number
}

const router = useRouter()
const loading = ref(true)
const docs = ref<DocumentRecord[]>([])
const catalogLatest = ref<CatalogItem[]>([])
const versionMap = ref<Record<string, string[]>>({})
const creating = ref(false)
const historyVisible = ref(false)
const historyVersions = ref<string[]>([])
const historyName = ref('')
const form = reactive({ name: '', ...DEFAULT_CABINET_BOUNDS })

const tableRows = computed<CabinetRow[]>(() =>
  docs.value.map(entry => {
    const catalogId = cabinetCatalogId(entry.json.id)
    const versions = versionMap.value[catalogId] ?? []
    const latest =
      versions[0] ??
      catalogLatest.value.find(c => c.id === catalogId)?.version ??
      INITIAL_CABINET_VERSION
    return {
      id: entry.json.id,
      catalogId,
      name: entry.json.name,
      size: boundsLabel(entry.json),
      nodes: entry.json.nodes.length,
      latestVersion: latest,
      versions,
      updatedAt: entry.updatedAt
    }
  })
)

async function refresh() {
  loading.value = true
  try {
    docs.value = await api.listDocuments('container')
    catalogLatest.value = await api.listCatalog({ placeableIn: 'scene', latestOnly: true })
    const map: Record<string, string[]> = {}
    await Promise.all(
      docs.value.map(async d => {
        const cid = cabinetCatalogId(d.json.id)
        map[cid] = await api.listCatalogVersions(cid)
      })
    )
    versionMap.value = map
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

function boundsLabel(json: EditorDocumentJSON): string {
  const { width, depth, height } = json.bounds
  return `${width} × ${depth} × ${height ?? 2} m`
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleString()
}

function openCreate() {
  form.name = `电柜 ${docs.value.length + 1}`
  Object.assign(form, DEFAULT_CABINET_BOUNDS)
  creating.value = true
}

async function submitCreate() {
  let json = createEmptyDocumentJSON({
    kind: 'container',
    id: `container-${Date.now().toString(36)}`,
    name: form.name || '未命名电柜',
    bounds: {
      width: form.width || 0.8,
      depth: form.depth || 0.6,
      height: form.height || 2
    }
  })
  json = setEditingVersion(json, INITIAL_CABINET_VERSION)
  await api.saveDocument(json)
  creating.value = false
  router.push(`/edit/container/${json.id}`)
}

async function remove(row: CabinetRow) {
  await ElMessageBox.confirm(`删除电柜「${row.name}」及全部 Catalog 版本？`, '确认', {
    type: 'warning'
  })
  await api.deleteDocument(row.id)
  await api.deleteCatalogItem(row.catalogId)
  ElMessage.success('已删除')
  await refresh()
}

function showHistory(row: CabinetRow) {
  historyName.value = row.name
  historyVersions.value = row.versions
  historyVisible.value = true
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1>电柜管理</h1>
        <p>编辑柜内布局；保存时可覆盖当前版本或按 semver 发布新版本。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建电柜</el-button>
    </header>

    <el-table v-loading="loading" :data="tableRows" stripe class="table" empty-text="暂无电柜">
      <el-table-column prop="id" label="编号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="size" label="尺寸" min-width="140" />
      <el-table-column prop="nodes" label="元件数" width="90" />
      <el-table-column label="最新版本" width="110">
        <template #default="{ row }">
          <el-tag size="small" type="warning">v{{ row.latestVersion }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="版本数" width="90">
        <template #default="{ row }">{{ row.versions.length || 0 }}</template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="160">
        <template #default="{ row }">{{ timeLabel(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/edit/container/${row.id}`)">
            编辑
          </el-button>
          <el-button link @click="showHistory(row)">版本历史</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="creating" title="新建电柜" width="500px">
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <div class="row3">
          <el-form-item label="宽 (m)">
            <el-input-number v-model="form.width" :min="0.2" :step="0.1" controls-position="right" />
          </el-form-item>
          <el-form-item label="深 (m)">
            <el-input-number v-model="form.depth" :min="0.2" :step="0.1" controls-position="right" />
          </el-form-item>
          <el-form-item label="高 (m)">
            <el-input-number v-model="form.height" :min="0.5" :step="0.1" controls-position="right" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="creating = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建并进入编辑器</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyVisible" :title="`${historyName} · 版本历史`" width="360px">
      <el-empty v-if="!historyVersions.length" description="尚未发布到 Catalog" :image-size="64" />
      <ul v-else class="ver-list">
        <li v-for="v in historyVersions" :key="v">v{{ v }}</li>
      </ul>
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  padding: 28px 32px 40px;
  min-height: 100%;
  background:
    radial-gradient(900px 420px at 20% -10%, rgba(31, 143, 255, 0.12), transparent 55%),
    #0b111b;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
}
h1 {
  margin: 0;
  font-size: 22px;
}
.head p {
  margin: 6px 0 0;
  color: #6d8199;
  font-size: 13px;
}
.table {
  width: 100%;
  --el-table-bg-color: #101a27;
  --el-table-tr-bg-color: #101a27;
  --el-table-header-bg-color: #121c2a;
  --el-table-row-hover-bg-color: #152233;
  --el-table-text-color: #cfe0f0;
  --el-table-header-text-color: #8ea4bd;
  --el-table-border-color: #1d2c3e;
}
.row3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.ver-list {
  margin: 0;
  padding-left: 18px;
  color: #cfe0f0;
  line-height: 1.9;
}
</style>
