<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { buildPublishBundle } from '@3d-editor/editor'
import type { CatalogProvider, DocumentKind, EditorDocumentJSON } from '@3d-editor/editor'
import Workbench from '@/components/Workbench.vue'
import {
  cabinetItemFromDocument,
  createEditorCatalog,
  getEditingVersion,
  setEditingVersion
} from '@/business/catalog'
import * as api from '@/business/api'
import { assertNewerSemver, bumpSemver, type SemverBump } from '@/business/semver'

const route = useRoute()
const router = useRouter()

const kind = route.params.kind as DocumentKind
const id = route.params.id as string

const initial = ref<EditorDocumentJSON | null>(null)
const catalog = ref<CatalogProvider | null>(null)
const editingVersion = ref('1.0.0')
const loading = ref(true)

const saveDialogVisible = ref(false)
const saveMode = ref<'overwrite' | 'new'>('overwrite')
const bumpKind = ref<SemverBump>('patch')
const customVersion = ref('')
const latestVersion = ref<string | undefined>()
const pendingJson = ref<EditorDocumentJSON | null>(null)
const saving = ref(false)

const nextVersionPreview = computed(() => {
  if (saveMode.value === 'overwrite') return editingVersion.value
  if (customVersion.value.trim()) return customVersion.value.trim()
  return bumpSemver(latestVersion.value ?? editingVersion.value, bumpKind.value)
})

onMounted(async () => {
  try {
    const rec = await api.getDocument(id)
    if (!rec) {
      ElMessage.error('文档不存在')
      router.replace('/manage/rooms')
      return
    }
    initial.value = rec.json
    editingVersion.value = getEditingVersion(rec.json)
    catalog.value = await createEditorCatalog(kind)
    if (kind === 'container') {
      const versions = await api.listCatalogVersions(`cabinet-${id}`)
      latestVersion.value = versions[0]
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
    router.replace('/')
  } finally {
    loading.value = false
  }
})

function onSave(json: EditorDocumentJSON) {
  if (kind === 'scene') {
    void saveSceneDraft(json)
    return
  }
  pendingJson.value = json
  saveMode.value = 'overwrite'
  customVersion.value = ''
  saveDialogVisible.value = true
}

async function saveSceneDraft(json: EditorDocumentJSON) {
  try {
    await api.saveDocument(json)
    initial.value = json
    ElMessage.success('电柜室草稿已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function confirmCabinetSave() {
  const json = pendingJson.value
  if (!json) return
  saving.value = true
  try {
    const version =
      saveMode.value === 'overwrite' ? editingVersion.value : nextVersionPreview.value
    if (saveMode.value === 'new') {
      assertNewerSemver(version, latestVersion.value)
    }
    const withVer = setEditingVersion(json, version)
    await api.saveDocument(withVer)
    const item = cabinetItemFromDocument(withVer, version)
    if (saveMode.value === 'overwrite') {
      await api.putCatalogItem(item)
    } else {
      await api.postCatalogItem(item)
    }
    editingVersion.value = version
    latestVersion.value =
      !latestVersion.value || version > latestVersion.value ? version : latestVersion.value
    // semver string compare is wrong for 1.10 vs 1.9 - refresh from API
    const versions = await api.listCatalogVersions(`cabinet-${id}`)
    latestVersion.value = versions[0]
    initial.value = withVer
    catalog.value = await createEditorCatalog(kind)
    saveDialogVisible.value = false
    ElMessage.success(
      saveMode.value === 'overwrite' ? `已覆盖 v${version}` : `已发布新版本 v${version}`
    )
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function onPublish(json: EditorDocumentJSON) {
  if (!catalog.value) return
  try {
    await api.saveDocument(json)
    const bundle = await buildPublishBundle(json, catalog.value)
    await api.publishScene(json.id, bundle)
    ElMessage.success('场景已发布（资产包已冻结）')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

function onBack() {
  router.push(kind === 'scene' ? '/manage/rooms' : '/manage/cabinets')
}
</script>

<template>
  <div v-if="loading" class="boot">加载中…</div>
  <Workbench
    v-else-if="initial && catalog"
    :kind="kind"
    :catalog="catalog"
    :initial="initial"
    :editing-version="kind === 'container' ? editingVersion : undefined"
    @save="onSave"
    @publish="onPublish"
    @back="onBack"
  />

  <el-dialog
    v-model="saveDialogVisible"
    title="保存电柜资产"
    width="420px"
    :close-on-click-modal="false"
  >
    <el-radio-group v-model="saveMode" class="mode-group">
      <el-radio value="overwrite">覆盖当前版本 v{{ editingVersion }}</el-radio>
      <el-radio value="new">发布为新版本</el-radio>
    </el-radio-group>

    <template v-if="saveMode === 'new'">
      <p class="hint">
        当前最新：{{ latestVersion ?? '无' }} · 新版本必须大于最新版（semver）
      </p>
      <el-form label-position="top" size="small">
        <el-form-item label="递增">
          <el-radio-group v-model="bumpKind">
            <el-radio-button value="patch">patch</el-radio-button>
            <el-radio-button value="minor">minor</el-radio-button>
            <el-radio-button value="major">major</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="或手输版本">
          <el-input v-model="customVersion" placeholder="如 1.2.0" />
        </el-form-item>
        <el-form-item label="将写入">
          <el-tag type="success">v{{ nextVersionPreview }}</el-tag>
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <el-button @click="saveDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="confirmCabinetSave">确认保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.boot {
  height: 100%;
  display: grid;
  place-items: center;
  color: #8ea4bd;
  background: #0b111b;
}
.mode-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}
.hint {
  font-size: 12px;
  color: #7a8fa6;
  margin: 0 0 10px;
}
</style>
