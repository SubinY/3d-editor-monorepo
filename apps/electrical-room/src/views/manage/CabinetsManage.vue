<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createEmptyDocumentJSON } from '@mh/3d-editor'
import type { EditorDocumentJSON } from '@mh/3d-editor'
import {
  DEFAULT_CABINET_BOUNDS,
  INITIAL_CABINET_VERSION,
  setEditingVersion
} from '@/business/catalog'
import * as api from '@/business/api'
import type { DocumentRecord } from '@/business/api'

interface CabinetRow {
  id: string
  name: string
  size: string
  nodes: number
  updatedAt: number
}

const router = useRouter()
const loading = ref(true)
const docs = ref<DocumentRecord[]>([])
const creating = ref(false)
const form = reactive({ name: '', ...DEFAULT_CABINET_BOUNDS })

const tableRows = computed<CabinetRow[]>(() =>
  docs.value.map(entry => ({
    id: entry.json.id,
    name: entry.json.name,
    size: boundsLabel(entry.json),
    nodes: entry.json.nodes.length,
    updatedAt: entry.updatedAt
  }))
)

async function refresh() {
  loading.value = true
  try {
    docs.value = await api.listContainers()
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
  await ElMessageBox.confirm(`删除电柜「${row.name}」文档？`, '确认', {
    type: 'warning'
  })
  await api.deleteDocument('container', row.id)
  ElMessage.success('已删除')
  await refresh()
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1>电柜管理</h1>
        <p>container 文档落在 <code>documents/containers/</code>；布局保存不再双写 Catalog。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建电柜</el-button>
    </header>

    <el-table v-loading="loading" :data="tableRows" stripe empty-text="暂无电柜">
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="id" label="文档 ID" min-width="160" />
      <el-table-column prop="size" label="尺寸" width="160" />
      <el-table-column prop="nodes" label="节点数" width="90" />
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ timeLabel(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/edit/container/${row.id}`)">
            设计
          </el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="creating"
      class="create-dialog"
      title="新建电柜"
      width="480px"
      align-center
    >
      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <div class="row3">
          <el-form-item label="宽 (m)">
            <el-input-number
              v-model="form.width"
              :min="0.2"
              :step="0.1"
              :precision="2"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="深 (m)">
            <el-input-number
              v-model="form.depth"
              :min="0.2"
              :step="0.1"
              :precision="2"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="高 (m)">
            <el-input-number
              v-model="form.height"
              :min="0.5"
              :step="0.1"
              :precision="2"
              controls-position="right"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="creating = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建并编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  padding: 20px 24px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
}
.head h1 {
  margin: 0 0 6px;
  font-size: 20px;
}
.head p {
  margin: 0;
  color: #7a8fa6;
  font-size: 13px;
}
.row3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.row3 :deep(.el-form-item) {
  margin-bottom: 0;
}
.row3 :deep(.el-input-number) {
  width: 100%;
}
</style>
