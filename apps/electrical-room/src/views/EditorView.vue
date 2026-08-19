<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { buildPublishBundle, createEmptyDocumentJSON } from '@mh/3d-editor'
import type { CatalogProvider, DocumentKind, EditorDocumentJSON } from '@mh/3d-editor'
import Workbench from '@/components/Workbench.vue'
import {
  cabinetItemFromDocument,
  createDemoCatalog,
  DEFAULT_CABINET_BOUNDS,
  DEFAULT_SCENE_BOUNDS,
  getEditingVersion,
  INITIAL_CABINET_VERSION,
  primeLayoutCache
} from '@/business/catalog'
import * as api from '@/business/api'

const route = useRoute()
const router = useRouter()

const kind = route.params.kind as DocumentKind
const id = route.params.id as string

const initial = ref<EditorDocumentJSON | null>(null)
const catalog = ref<CatalogProvider | null>(null)
const editingVersion = ref('1.0.0')
const loading = ref(true)
const publishing = ref(false)

onMounted(async () => {
  try {
    if (kind === 'scene') {
      const [boot, containers] = await Promise.all([
        api.fetchSceneBootstrap(id),
        api.listContainers().catch(() => [])
      ])
      const placeable = containers.map(rec =>
        cabinetItemFromDocument(rec.json, INITIAL_CABINET_VERSION)
      )
      primeLayoutCache(boot.containerLayouts ?? {})
      for (const rec of containers) {
        if (rec.json.kind === 'container') {
          primeLayoutCache({ [rec.json.id]: rec.json })
        }
      }
      catalog.value = createDemoCatalog('scene', placeable)
      if (boot.document) {
        initial.value = boot.document
      } else {
        initial.value = createEmptyDocumentJSON({
          kind: 'scene',
          id,
          name: boot.room.name || id,
          bounds: {
            width: boot.room.length || DEFAULT_SCENE_BOUNDS.width,
            depth: boot.room.width || DEFAULT_SCENE_BOUNDS.depth,
            height: boot.room.height || DEFAULT_SCENE_BOUNDS.height
          }
        })
      }
    } else if (kind === 'container') {
      const boot = await api.fetchContainerBootstrap(id)
      catalog.value = createDemoCatalog('container', [])
      if (boot.document) {
        initial.value = boot.document
        editingVersion.value = getEditingVersion(boot.document)
      } else {
        initial.value = createEmptyDocumentJSON({
          kind: 'container',
          id,
          name: boot.cabinet.name || id,
          bounds: {
            width: boot.cabinet.length || DEFAULT_CABINET_BOUNDS.width,
            depth: boot.cabinet.width || DEFAULT_CABINET_BOUNDS.depth,
            height: boot.cabinet.height || DEFAULT_CABINET_BOUNDS.height
          }
        })
      }
    } else {
      throw new Error('无效文档类型')
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
    router.replace(kind === 'container' ? '/manage/cabinets' : '/manage/rooms')
  } finally {
    loading.value = false
  }
})

async function onSave(json: EditorDocumentJSON) {
  try {
    await api.saveDocument(json, json.name)
    initial.value = json
    if (json.kind === 'container') {
      editingVersion.value = getEditingVersion(json)
    }
    ElMessage.success(kind === 'scene' ? '电柜室已保存' : '电柜已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function onPublish(json: EditorDocumentJSON) {
  if (!catalog.value || json.kind !== 'scene') return
  if (publishing.value) return
  publishing.value = true
  try {
    await api.saveDocument(json, json.name)
    initial.value = json
    const bundle = await buildPublishBundle(json, catalog.value)
    const saved = await api.publishScene(json.id, bundle)
    const url = api.publishedMonitorUrl(saved.sceneId, saved.version)
    const path = api.publishedMonitorPath(saved.sceneId, saved.version)
    try {
      await navigator.clipboard.writeText(url)
      ElMessage.success(`已发布 v${saved.version}，监控地址已复制`)
    } catch {
      ElMessage.success(`已发布 v${saved.version}`)
    }
    await ElMessageBox.confirm(
      `${url}\n\n这是冻结发布包的 3D 监控页（v${saved.version}）。`,
      '发布成功',
      {
        confirmButtonText: '打开监控页',
        cancelButtonText: '关闭',
        distinguishCancelAndClose: true
      }
    )
      .then(() => router.push(path))
      .catch(() => undefined)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  } finally {
    publishing.value = false
  }
}

function onBack() {
  const fromScene = typeof route.query.fromScene === 'string' ? route.query.fromScene : ''
  if (kind === 'container' && fromScene) {
    router.push(`/edit/scene/${fromScene}`)
    return
  }
  router.push(kind === 'scene' ? '/manage/rooms' : '/manage/cabinets')
}

async function onEditCabinet(payload: { cabinetId: string; json: EditorDocumentJSON }) {
  try {
    await api.saveDocument(payload.json, payload.json.name)
    initial.value = payload.json
    await router.push({
      path: `/edit/container/${payload.cabinetId}`,
      query: { fromScene: id }
    })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '进入柜体编辑失败')
  }
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
    :publishing="publishing"
    @save="onSave"
    @publish="onPublish"
    @edit-cabinet="onEditCabinet"
    @back="onBack"
  />
</template>

<style scoped>
.boot {
  height: 100%;
  display: grid;
  place-items: center;
  color: #8ea4bd;
  background: #0b111b;
}
</style>
