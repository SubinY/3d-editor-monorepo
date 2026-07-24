<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DocumentKind, EditorDocumentJSON } from '@3d-editor/editor'
import Workbench from '@/components/Workbench.vue'
import { createEditorCatalog } from '@/business/catalog'
import { getDocument, saveDocument } from '@/business/storage'

const route = useRoute()
const router = useRouter()

const kind = route.params.kind as DocumentKind
const id = route.params.id as string

const initial = computed(() => getDocument(id))
if (!initial.value) {
  router.replace('/')
}

const catalog = createEditorCatalog(kind)

function onSave(json: EditorDocumentJSON) {
  saveDocument(json)
}
</script>

<template>
  <Workbench
    v-if="initial"
    :kind="kind"
    :catalog="catalog"
    :initial="initial"
    @save="onSave"
    @back="router.push('/')"
  />
</template>
