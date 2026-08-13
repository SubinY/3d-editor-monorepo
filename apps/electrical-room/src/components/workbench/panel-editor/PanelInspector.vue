<script setup lang="ts">
import { ref, watch } from 'vue'
import type { panel } from '@mh/3d-editor-assets/common'
import ColorField from './fields/ColorField.vue'
import ImageAssetField from './fields/ImageAssetField.vue'

const props = defineProps<{
  draft: panel.PanelContentJSON
  selected: panel.PanelElement | null
}>()

const emit = defineEmits<{
  change: []
  removeSelected: []
}>()

type BgType = 'color' | 'image'
type BgFit = NonNullable<panel.PanelContentJSON['backgroundImageFit']>
type Billboard = NonNullable<panel.PanelContentJSON['billboard']>

const bgType = ref<BgType>('color')

watch(
  () => props.draft,
  d => {
    bgType.value = d.backgroundImage ? 'image' : 'color'
  },
  { immediate: true }
)

function setBgType(mode: BgType) {
  bgType.value = mode
  if (mode === 'color') {
    props.draft.backgroundImage = undefined
    props.draft.backgroundImageName = undefined
    if (!props.draft.background || props.draft.background === 'transparent') {
      props.draft.background = '#0c1420'
    }
  } else {
    props.draft.backgroundImageFit = props.draft.backgroundImageFit ?? 'original'
  }
  emit('change')
}

function onBgImagePick(payload: { url: string; name: string }) {
  bgType.value = 'image'
  props.draft.backgroundImage = payload.url
  props.draft.backgroundImageName = payload.name
  props.draft.backgroundImageFit = props.draft.backgroundImageFit ?? 'original'
  emit('change')
}

function onBgImageClear() {
  props.draft.backgroundImage = undefined
  props.draft.backgroundImageName = undefined
  emit('change')
}

function onElementImagePick(payload: { url: string; name: string }) {
  if (!props.selected || props.selected.type !== 'image') return
  props.selected.url = payload.url
  if (!props.selected.name || props.selected.name === '图片') {
    props.selected.name = payload.name
  }
  emit('change')
}

function opacityOf(el: panel.PanelElement): number {
  return el.opacity ?? 1
}

function setOpacity(el: panel.PanelElement, v: number | undefined) {
  el.opacity = Number(v ?? 1)
  emit('change')
}
</script>

<template>
  <aside class="inspector">
    <!-- 未选中：仅面板基本属性 -->
    <template v-if="!selected">
      <div class="label">面板属性</div>
      <el-form label-position="left" label-width="72px" size="small" class="form">
        <el-form-item label="宽度">
          <el-input-number
            v-model="draft.width"
            :min="128"
            :step="64"
            controls-position="right"
            @change="emit('change')"
          />
        </el-form-item>
        <el-form-item label="高度">
          <el-input-number
            v-model="draft.height"
            :min="128"
            :step="64"
            controls-position="right"
            @change="emit('change')"
          />
        </el-form-item>
        <el-form-item label="广告牌模式">
          <el-select
            :model-value="draft.billboard ?? 'yaw'"
            @change="
              v => {
                draft.billboard = v as Billboard
                emit('change')
              }
            "
          >
            <el-option label="不设置" value="none" />
            <el-option label="水平面向相机" value="yaw" />
            <el-option label="垂直面向相机" value="full" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select :model-value="bgType" @change="v => setBgType(v as BgType)">
            <el-option label="颜色" value="color" />
            <el-option label="图片" value="image" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="bgType === 'color'" label="颜色">
          <ColorField
            :model-value="draft.background || '#0c1420'"
            @update:model-value="v => { draft.background = v }"
            @change="emit('change')"
          />
        </el-form-item>
        <template v-else>
          <el-form-item label="背景图片">
            <ImageAssetField
              :url="draft.backgroundImage"
              :name="draft.backgroundImageName"
              @pick="onBgImagePick"
              @clear="onBgImageClear"
            />
          </el-form-item>
          <el-form-item label="填充方式">
            <el-select
              :model-value="draft.backgroundImageFit ?? 'original'"
              @change="
                v => {
                  draft.backgroundImageFit = v as BgFit
                  emit('change')
                }
              "
            >
              <el-option label="原始大小" value="original" />
              <el-option label="拉伸" value="stretch" />
              <el-option label="覆盖" value="cover" />
              <el-option label="包含" value="contain" />
            </el-select>
          </el-form-item>
        </template>
      </el-form>
    </template>

    <!-- 选中：元素属性 -->
    <template v-else>
      <div class="label">选中元素</div>
      <el-form label-position="left" label-width="72px" size="small" class="form">
        <el-form-item label="名称">
          <el-input v-model="selected.name" @change="emit('change')" />
        </el-form-item>
        <el-form-item label="宽">
          <el-input-number
            v-model="selected.width"
            :min="1"
            controls-position="right"
            @change="emit('change')"
          />
        </el-form-item>
        <el-form-item label="高">
          <el-input-number
            v-model="selected.height"
            :min="1"
            controls-position="right"
            @change="emit('change')"
          />
        </el-form-item>
        <el-form-item label="透明度">
          <el-slider
            :model-value="opacityOf(selected)"
            :min="0"
            :max="1"
            :step="0.05"
            @update:model-value="v => { selected.opacity = Number(v) }"
            @change="v => setOpacity(selected, Number(v))"
          />
        </el-form-item>

        <template v-if="selected.type === 'text'">
          <el-form-item label="背景色">
            <ColorField
              :model-value="selected.background || '#000000'"
              fallback="#000000"
              @update:model-value="v => { selected.background = v }"
              @change="emit('change')"
            />
          </el-form-item>
          <el-form-item label="文本">
            <el-input v-model="selected.text" @change="emit('change')" />
          </el-form-item>
          <el-form-item label="颜色">
            <ColorField
              :model-value="selected.color || '#ffffff'"
              fallback="#ffffff"
              @update:model-value="v => { selected.color = v }"
              @change="emit('change')"
            />
          </el-form-item>
          <el-form-item label="对齐方式">
            <el-select
              :model-value="selected.align ?? 'left'"
              @change="
                v => {
                  selected.align = v as CanvasTextAlign
                  emit('change')
                }
              "
            >
              <el-option label="左对齐" value="left" />
              <el-option label="居中" value="center" />
              <el-option label="右对齐" value="right" />
            </el-select>
          </el-form-item>
          <el-form-item label="字号">
            <el-input-number
              v-model="selected.fontSize"
              :min="8"
              controls-position="right"
              @change="emit('change')"
            />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="图片">
            <ImageAssetField
              :url="selected.url"
              :name="selected.name"
              @pick="onElementImagePick"
              @clear="
                () => {
                  selected.url = ''
                  emit('change')
                }
              "
            />
          </el-form-item>
        </template>

        <el-button type="danger" plain class="danger" @click="emit('removeSelected')">
          删除元素
        </el-button>
      </el-form>
    </template>
  </aside>
</template>

<style scoped>
.inspector {
  padding: 10px;
  border-left: 1px solid #243041;
  overflow: auto;
}

.label {
  font-size: 11px;
  color: #8aa0b5;
  margin-bottom: 8px;
}

.form {
  width: 100%;
}

.form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.form :deep(.el-input-number),
.form :deep(.el-select) {
  width: 100%;
}

.danger {
  width: 100%;
  margin-top: 4px;
}
</style>
