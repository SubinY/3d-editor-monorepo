<script setup lang="ts">
import type { EnvironmentJSON } from '@mh/3d-editor'

const props = defineProps<{
  form: EnvironmentJSON
}>()

const emit = defineEmits<{
  commit: []
}>()

function commit() {
  emit('commit')
}
</script>

<template>
  <el-form label-position="left" label-width="88px" size="small">
    <div class="section-head">背景</div>
    <el-form-item label="类型">
      <el-select
        :model-value="form.background.type"
        @change="
          mode => {
            if (mode === 'color') form.background = { type: 'color', value: '#0c1420' }
            else form.background = { type: 'equirect', url: '' }
            commit()
          }
        "
      >
        <el-option label="纯色" value="color" />
        <el-option label="全景" value="equirect" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="form.background.type === 'color'" label="颜色">
      <div class="color-row">
        <el-color-picker
          :model-value="form.background.value"
          @change="
            v => {
              form.background = { type: 'color', value: v || '#0c1420' }
              commit()
            }
          "
        />
        <el-input
          :model-value="form.background.value"
          @change="
            v => {
              form.background = { type: 'color', value: String(v || '#0c1420') }
              commit()
            }
          "
        />
      </div>
    </el-form-item>
    <el-form-item v-else label="全景 URL">
      <el-input
        :model-value="form.background.url"
        placeholder="https://…/.hdr 或 .jpg"
        @change="
          v => {
            form.background = { type: 'equirect', url: String(v || '') }
            commit()
          }
        "
      />
    </el-form-item>
  </el-form>
</template>
