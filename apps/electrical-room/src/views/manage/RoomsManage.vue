<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createEmptyDocumentJSON } from '@mh/3d-editor'
import type { EditorDocumentJSON } from '@mh/3d-editor'
import { DEFAULT_SCENE_BOUNDS } from '@/business/catalog'
import { createDemoSceneJSON } from '@/business/demo-scene'
import * as api from '@/business/api'
import type { DocumentRecord, PublishVersionMeta } from '@/business/api'

const router = useRouter()
const loading = ref(true)
const rows = ref<DocumentRecord[]>([])
const latestPublish = ref<Record<string, PublishVersionMeta>>({})
const creating = ref(false)
const form = reactive({ name: '', location: '', ...DEFAULT_SCENE_BOUNDS })

const versionsOpen = ref(false)
const versionsLoading = ref(false)
const versionsSceneId = ref('')
const versionsSceneName = ref('')
const versionRows = ref<PublishVersionMeta[]>([])

const tableRows = computed(() =>
  rows.value.map(entry => {
    const pub = latestPublish.value[entry.json.id]
    return {
      id: entry.json.id,
      name: entry.json.name,
      location: String(entry.json.metadata?.location ?? '—'),
      size: boundsLabel(entry.json),
      walls: entry.json.structure?.walls?.length ?? 0,
      devices: entry.json.nodes.length,
      updatedAt: entry.updatedAt,
      publishVersion: pub?.version,
      publishedAt: pub?.publishedAt
    }
  })
)

async function refresh() {
  loading.value = true
  try {
    const [scenes, publishes] = await Promise.all([
      api.listScenes(),
      api.listLatestPublishes().catch(() => [] as PublishVersionMeta[])
    ])
    rows.value = scenes
    const map: Record<string, PublishVersionMeta> = {}
    for (const p of publishes) map[p.sceneId] = p
    latestPublish.value = map
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

function boundsLabel(json: EditorDocumentJSON): string {
  const { width, depth, height } = json.bounds
  return height ? `${width} × ${depth} × ${height} m` : `${width} × ${depth} m`
}

function timeLabel(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : '—'
}

function openCreate() {
  form.name = `电柜室 ${rows.value.length + 1}`
  form.location = ''
  Object.assign(form, DEFAULT_SCENE_BOUNDS)
  creating.value = true
}

async function submitCreate() {
  const json = createEmptyDocumentJSON({
    kind: 'scene',
    id: `scene-${Date.now().toString(36)}`,
    name: form.name || '未命名电柜室',
    bounds: {
      width: form.width || DEFAULT_SCENE_BOUNDS.width,
      depth: form.depth || DEFAULT_SCENE_BOUNDS.depth,
      height: form.height || DEFAULT_SCENE_BOUNDS.height
    },
    metadata: form.location ? { location: form.location } : undefined
  })
  await api.saveDocument(json)
  creating.value = false
  router.push(`/edit/scene/${json.id}`)
}

async function createDemo() {
  try {
    const json = await createDemoSceneJSON()
    ElMessage.success(`已生成示例「${json.name}」`)
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '生成失败')
  }
}

async function remove(id: string, name: string) {
  await ElMessageBox.confirm(`删除电柜室「${name}」？`, '确认', {
    type: 'warning'
  })
  await api.deleteDocument('scene', id)
  ElMessage.success('已删除')
  await refresh()
}

async function openVersions(row: { id: string; name: string }) {
  versionsSceneId.value = row.id
  versionsSceneName.value = row.name
  versionsOpen.value = true
  versionsLoading.value = true
  versionRows.value = []
  try {
    versionRows.value = await api.listPublishVersions(row.id)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载版本失败')
  } finally {
    versionsLoading.value = false
  }
}

function openPublished(sceneId: string, version: number) {
  versionsOpen.value = false
  router.push(api.publishedMonitorPath(sceneId, version))
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1>电柜室管理</h1>
        <p>设计布局；保存后可进入预览查看柜内与点位驱动。</p>
      </div>
      <div class="actions">
        <el-button @click="createDemo">生成示例电柜室</el-button>
        <el-button type="primary" @click="openCreate">新建电柜室</el-button>
      </div>
    </header>

    <el-table
      v-loading="loading"
      :data="tableRows"
      stripe
      class="table"
      empty-text="暂无电柜室"
    >
      <el-table-column prop="id" label="编号" min-width="140" show-overflow-tooltip />
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="location" label="位置" min-width="120" />
      <el-table-column prop="size" label="尺寸" min-width="140" />
      <el-table-column label="墙/设备" width="100">
        <template #default="{ row }">{{ row.walls }} / {{ row.devices }}</template>
      </el-table-column>
      <el-table-column label="已发布" width="110">
        <template #default="{ row }">
          <el-button
            v-if="row.publishVersion"
            link
            type="success"
            @click="openVersions(row)"
          >
            v{{ row.publishVersion }}
          </el-button>
          <span v-else class="muted">未发布</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="160">
        <template #default="{ row }">{{ timeLabel(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/edit/scene/${row.id}`)">
            设计
          </el-button>
          <el-button link @click="router.push(`/preview/${row.id}`)">预览</el-button>
          <el-button link type="danger" @click="remove(row.id, row.name)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="creating"
      class="create-dialog"
      title="新建电柜室"
      width="480px"
      align-center
    >
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="位置 / 备注">
          <el-input v-model="form.location" placeholder="选填" />
        </el-form-item>
        <div class="row3">
          <el-form-item label="宽 (m)">
            <el-input-number
              v-model="form.width"
              :min="1"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="深 (m)">
            <el-input-number
              v-model="form.depth"
              :min="1"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="高 (m)">
            <el-input-number
              v-model="form.height"
              :min="1"
              :step="0.5"
              controls-position="right"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="creating = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建并进入编辑器</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="versionsOpen"
      :title="`发布版本 · ${versionsSceneName}`"
      width="520px"
      align-center
    >
      <el-table
        v-loading="versionsLoading"
        :data="versionRows"
        class="table"
        empty-text="暂无发布版本"
        max-height="360"
      >
        <el-table-column label="版本" width="90">
          <template #default="{ row }">
            <el-button link type="primary" @click="openPublished(row.sceneId, row.version)">
              v{{ row.version }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="发布时间" min-width="160">
          <template #default="{ row }">{{ timeLabel(row.publishedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="openPublished(row.sceneId, row.version)">
              打开
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
  gap: 16px;
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
.actions {
  display: flex;
  gap: 8px;
}
.muted {
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
