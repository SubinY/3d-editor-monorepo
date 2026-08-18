<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Delete, Edit, MoreFilled, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  loadCommBundle,
  removeCommPoint,
  removeCommSource,
  upsertCommPoint,
  upsertCommSource
} from '@/business/comm-store'
import {
  COMM_PROTOCOL_LABEL,
  COMM_PROTOCOLS,
  createCommId,
  emptyCommBundle,
  type CommBundle,
  type CommHttpSource,
  type CommMqttSource,
  type CommPoint,
  type CommProtocol,
  type CommSource,
  type CommWsSource
} from '@/business/comm-types'

const bundle = ref<CommBundle>(emptyCommBundle())

async function refresh() {
  bundle.value = await loadCommBundle()
}

onMounted(() => {
  void refresh()
})

const hasSources = computed(() => bundle.value.sources.length > 0)

function sourcesOf(protocol: CommProtocol): CommSource[] {
  return bundle.value.sources.filter(s => s.protocol === protocol)
}

const sourceDialogVisible = ref(false)
const sourceEditingId = ref<string | null>(null)
const sourceForm = reactive({
  protocol: 'http' as CommProtocol,
  name: '',
  // http
  url: '',
  method: 'POST' as 'GET' | 'POST',
  intervalMs: 2000,
  headersJson: '',
  // ws / mqtt
  scheme: 'ws' as 'ws' | 'wss',
  host: '',
  protocols: '',
  topics: '',
  clientId: '',
  username: '',
  password: ''
})

function resetSourceForm(protocol: CommProtocol = 'http') {
  sourceEditingId.value = null
  sourceForm.protocol = protocol
  sourceForm.name = ''
  sourceForm.url = ''
  sourceForm.method = 'POST'
  sourceForm.intervalMs = 2000
  sourceForm.headersJson = ''
  sourceForm.scheme = 'ws'
  sourceForm.host = ''
  sourceForm.protocols = ''
  sourceForm.topics = ''
  sourceForm.clientId = `client_${Math.random().toString(36).slice(2, 8)}`
  sourceForm.username = ''
  sourceForm.password = ''
}

function openAddSource(protocol?: CommProtocol) {
  resetSourceForm(protocol ?? 'http')
  sourceDialogVisible.value = true
}

function openEditSource(source: CommSource) {
  sourceEditingId.value = source.id
  sourceForm.protocol = source.protocol
  sourceForm.name = source.name
  if (source.protocol === 'http') {
    sourceForm.url = source.url
    sourceForm.method = source.method
    sourceForm.intervalMs = source.intervalMs
    sourceForm.headersJson = source.headersJson ?? ''
  } else if (source.protocol === 'ws') {
    sourceForm.scheme = source.scheme
    sourceForm.host = source.host
    sourceForm.protocols = source.protocols ?? ''
  } else {
    sourceForm.scheme = source.scheme
    sourceForm.host = source.host
    sourceForm.topics = source.topics
    sourceForm.clientId = source.clientId
    sourceForm.username = source.username ?? ''
    sourceForm.password = source.password ?? ''
  }
  sourceDialogVisible.value = true
}

function formatJsonField(field: 'headersJson') {
  const raw = sourceForm[field].trim()
  if (!raw) return
  try {
    sourceForm[field] = JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    ElMessage.warning('不是合法 JSON')
  }
}

function buildSourceFromForm(): CommSource | null {
  const name = sourceForm.name.trim()
  if (!name) {
    ElMessage.warning('请填写数据源名称')
    return null
  }
  const id = sourceEditingId.value ?? createCommId('src')
  const existing = bundle.value.sources.find(s => s.id === id)
  const points = existing?.points ?? []

  if (sourceForm.protocol === 'http') {
    if (!sourceForm.url.trim()) {
      ElMessage.warning('请填写 URL')
      return null
    }
    const src: CommHttpSource = {
      id,
      name,
      protocol: 'http',
      url: sourceForm.url.trim(),
      method: sourceForm.method,
      intervalMs: Number(sourceForm.intervalMs) || 2000,
      headersJson: sourceForm.headersJson.trim() || undefined,
      points
    }
    return src
  }

  if (sourceForm.protocol === 'ws') {
    if (!sourceForm.host.trim()) {
      ElMessage.warning('请填写 WebSocket 地址')
      return null
    }
    const src: CommWsSource = {
      id,
      name,
      protocol: 'ws',
      scheme: sourceForm.scheme,
      host: sourceForm.host.trim(),
      protocols: sourceForm.protocols.trim() || undefined,
      points
    }
    return src
  }

  if (!sourceForm.host.trim() || !sourceForm.topics.trim() || !sourceForm.clientId.trim()) {
    ElMessage.warning('请完善 MQTT 必填项')
    return null
  }
  const src: CommMqttSource = {
    id,
    name,
    protocol: 'mqtt',
    scheme: sourceForm.scheme,
    host: sourceForm.host.trim(),
    topics: sourceForm.topics.trim(),
    clientId: sourceForm.clientId.trim(),
    username: sourceForm.username.trim() || undefined,
    password: sourceForm.password || undefined,
    points
  }
  return src
}

async function confirmSource() {
  const src = buildSourceFromForm()
  if (!src) return
  try {
    await upsertCommSource(src)
    await refresh()
    sourceDialogVisible.value = false
    ElMessage.success(sourceEditingId.value ? '已更新数据源' : '已添加数据源')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存数据源失败')
  }
}

async function onDeleteSource(source: CommSource) {
  try {
    await removeCommSource(source.id)
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除数据源失败')
  }
}

const pointDialogVisible = ref(false)
const pointSourceId = ref('')
const pointForm = reactive({ name: '', key: '' })

function openAddPoint(source: CommSource) {
  pointSourceId.value = source.id
  pointForm.name = ''
  pointForm.key = ''
  pointDialogVisible.value = true
}

async function confirmPoint() {
  const name = pointForm.name.trim()
  const key = pointForm.key.trim()
  if (!name || !key) {
    ElMessage.warning('请填写变量名称与标识')
    return
  }
  const point: CommPoint = {
    id: createCommId('pt'),
    name,
    key
  }
  try {
    await upsertCommPoint(pointSourceId.value, point)
    await refresh()
    pointDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存点位失败')
  }
}

async function onDeletePoint(sourceId: string, pointId: string) {
  try {
    await removeCommPoint(sourceId, pointId)
    await refresh()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除点位失败')
  }
}
</script>

<template>
  <div class="comm-panel">
    <template v-if="!hasSources">
      <div class="empty-state">
        <p class="empty-title">尚未配置数据源</p>
        <p class="hint">可供绑定的源和点位，不自动连网；不写入场景 Document。</p>
        <el-button type="primary" :icon="Plus" @click="openAddSource()">添加数据源</el-button>
      </div>
    </template>

    <template v-else>
      <div class="toolbar">
        <span class="toolbar-label">通信数据源</span>
        <el-button size="small" type="primary" :icon="Plus" @click="openAddSource()">
          添加
        </el-button>
      </div>

      <div v-for="protocol in COMM_PROTOCOLS" :key="protocol" class="proto-block">
        <div class="proto-head">
          <span>{{ COMM_PROTOCOL_LABEL[protocol] }}</span>
          <el-button
            link
            type="primary"
            size="small"
            :icon="Plus"
            title="添加该协议数据源"
            @click="openAddSource(protocol)"
          />
        </div>

        <div v-if="sourcesOf(protocol).length === 0" class="proto-empty">
          暂无 {{ COMM_PROTOCOL_LABEL[protocol] }} 数据
        </div>

        <el-tree
          v-else
          class="comm-tree"
          :data="
            sourcesOf(protocol).map(s => ({
              id: s.id,
              label: s.name,
              source: s,
              children: s.points.map(p => ({
                id: p.id,
                label: p.name,
                point: p,
                sourceId: s.id
              }))
            }))
          "
          node-key="id"
          :default-expand-all="true"
          :expand-on-click-node="false"
        >
          <template #default="{ data }">
            <div class="tree-row">
              <span class="tree-label">
                {{ data.label }}
                <span v-if="data.point" class="tree-key">{{ data.point.key }}</span>
              </span>
              <span class="tree-actions" @click.stop>
                <template v-if="data.source">
                  <el-button link size="small" :icon="Plus" @click="openAddPoint(data.source)" />
                  <el-dropdown trigger="click">
                    <el-button link size="small" :icon="MoreFilled" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item :icon="Edit" @click="openEditSource(data.source)">
                          编辑
                        </el-dropdown-item>
                        <el-dropdown-item
                          :icon="Delete"
                          divided
                          @click="onDeleteSource(data.source)"
                        >
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </template>
                <el-button
                  v-else-if="data.point"
                  link
                  type="danger"
                  size="small"
                  :icon="Delete"
                  @click="onDeletePoint(data.sourceId, data.point.id)"
                />
              </span>
            </div>
          </template>
        </el-tree>
      </div>
    </template>

    <el-dialog
      v-model="sourceDialogVisible"
      :title="sourceEditingId ? '编辑数据源' : '新建数据源'"
      width="400px"
      append-to-body
      class="comm-dialog"
      @closed="resetSourceForm()"
    >
      <el-form label-position="top" size="small">
        <el-form-item label="数据源类型" required>
          <el-select
            v-model="sourceForm.protocol"
            :disabled="!!sourceEditingId"
            style="width: 100%"
          >
            <el-option
              v-for="p in COMM_PROTOCOLS"
              :key="p"
              :label="COMM_PROTOCOL_LABEL[p]"
              :value="p"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数据源名称" required>
          <el-input v-model="sourceForm.name" placeholder="请输入数据源名称" />
        </el-form-item>

        <template v-if="sourceForm.protocol === 'http'">
          <el-form-item label="URL 地址" required>
            <el-input v-model="sourceForm.url" placeholder="请输入 http:// 或 https:// 地址" />
          </el-form-item>
          <el-form-item label="请求方式" required>
            <el-select v-model="sourceForm.method" style="width: 100%">
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
            </el-select>
          </el-form-item>
          <el-form-item label="请求间隔" required>
            <el-input-number
              v-model="sourceForm.intervalMs"
              :min="200"
              :step="100"
              controls-position="right"
              style="width: 100%"
            />
            <span class="field-suffix">ms</span>
          </el-form-item>
          <el-form-item label="请求头">
            <el-input
              v-model="sourceForm.headersJson"
              type="textarea"
              :rows="3"
              placeholder='可选，合法 JSON，如 {"Authorization":"Bearer xxx"}'
            />
            <el-button link size="small" class="fmt-btn" @click="formatJsonField('headersJson')">
              格式化
            </el-button>
          </el-form-item>
        </template>

        <template v-else-if="sourceForm.protocol === 'ws'">
          <el-form-item label="URL 地址" required>
            <div class="url-row">
              <el-select v-model="sourceForm.scheme" style="width: 88px">
                <el-option label="ws" value="ws" />
                <el-option label="wss" value="wss" />
              </el-select>
              <el-input
                v-model="sourceForm.host"
                placeholder="如 192.168.10.10:8080/api/twin/ws"
              />
            </div>
          </el-form-item>
          <el-form-item label="Protocols">
            <el-input
              v-model="sourceForm.protocols"
              placeholder="如服务端不要求，可留空"
            />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="URL 地址" required>
            <div class="url-row">
              <el-select v-model="sourceForm.scheme" style="width: 88px">
                <el-option label="ws" value="ws" />
                <el-option label="wss" value="wss" />
              </el-select>
              <el-input
                v-model="sourceForm.host"
                placeholder="如 192.168.10.10:1884"
              />
            </div>
          </el-form-item>
          <el-form-item label="Topics" required>
            <el-input v-model="sourceForm.topics" placeholder="多个可用逗号分隔" />
          </el-form-item>
          <el-form-item label="Client ID" required>
            <el-input v-model="sourceForm.clientId" placeholder="请输入 Client ID" />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="sourceForm.username" placeholder="可选" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="sourceForm.password"
              type="password"
              show-password
              placeholder="可选"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button size="small" @click="sourceDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmSource">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="pointDialogVisible"
      title="新增变量"
      width="360px"
      append-to-body
    >
      <el-form label-position="top" size="small">
        <el-form-item label="变量名称" required>
          <el-input v-model="pointForm.name" placeholder="请输入变量名称" />
        </el-form-item>
        <el-form-item label="变量标识" required>
          <el-input v-model="pointForm.key" placeholder="请输入变量标识（如 temp）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="pointDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmPoint">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.comm-panel {
  padding: 12px;
  color: #c5d4e4;
  min-height: 100%;
  box-sizing: border-box;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 16px;
  text-align: center;
}

.empty-title {
  margin: 0;
  font-size: 14px;
  color: #e8f1fa;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: #7a8fa6;
  line-height: 1.5;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.toolbar-label {
  font-size: 13px;
  color: #e8f1fa;
  font-weight: 500;
}

.proto-block {
  margin-bottom: 14px;
}

.proto-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #9eb2c7;
  margin-bottom: 6px;
  padding: 0 2px;
}

.proto-empty {
  font-size: 12px;
  color: #5f7388;
  padding: 6px 8px 10px 18px;
}

.comm-tree {
  background: transparent;
  color: #c5d4e4;
  --el-tree-node-hover-bg-color: #162232;
}

.comm-tree :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 4px;
}

.tree-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding-right: 4px;
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.tree-key {
  margin-left: 6px;
  font-size: 11px;
  color: #6b8299;
}

.tree-actions {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.75;
}

.tree-row:hover .tree-actions {
  opacity: 1;
}

.url-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.field-suffix {
  margin-left: 8px;
  color: #7a8fa6;
  font-size: 12px;
}

.fmt-btn {
  margin-top: 4px;
}
</style>
