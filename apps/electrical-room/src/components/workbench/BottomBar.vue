<script setup lang="ts">
defineProps<{
  snapEnabled: boolean
  collisionEnabled: boolean
  rulersEnabled: boolean
  showRulers: boolean
  objectCount: number
  perfVisible: boolean
}>()

const emit = defineEmits<{
  'update:snapEnabled': [v: boolean]
  'update:collisionEnabled': [v: boolean]
  'update:rulersEnabled': [v: boolean]
  'update:perfVisible': [v: boolean]
}>()
</script>

<template>
  <footer class="bottom">
    <div class="left">
      <label class="sw">
        吸附
        <input
          type="checkbox"
          :checked="snapEnabled"
          @change="emit('update:snapEnabled', ($event.target as HTMLInputElement).checked)"
        />
        <i />
      </label>
      <label class="sw">
        碰撞
        <input
          type="checkbox"
          :checked="collisionEnabled"
          @change="emit('update:collisionEnabled', ($event.target as HTMLInputElement).checked)"
        />
        <i />
      </label>
      <label v-if="showRulers" class="sw">
        标尺
        <input
          type="checkbox"
          :checked="rulersEnabled"
          @change="emit('update:rulersEnabled', ($event.target as HTMLInputElement).checked)"
        />
        <i />
      </label>
    </div>
    <div class="perf">
      <span>物体 {{ objectCount }}</span>
      <button
        type="button"
        :class="{ on: perfVisible }"
        @click="emit('update:perfVisible', !perfVisible)"
      >
        性能
      </button>
    </div>
  </footer>
</template>

<style scoped>
.bottom {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  background: #0a121c;
  border-top: 1px solid #1a2738;
  font-size: 12px;
  color: #8ea4bd;
  flex-shrink: 0;
}
.left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.sw {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  position: relative;
}
.sw input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.sw i {
  width: 34px;
  height: 18px;
  border-radius: 999px;
  background: #243246;
  position: relative;
  transition: 0.15s ease;
}
.sw i::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #9db0c5;
  transition: 0.15s ease;
}
.sw input:checked + i {
  background: #1f6fff;
}
.sw input:checked + i::after {
  left: 18px;
  background: #fff;
}
.perf {
  display: flex;
  align-items: center;
  gap: 14px;
  font-variant-numeric: tabular-nums;
}
.perf button {
  border: 1px solid #2a3c52;
  background: #152033;
  color: #c5d4e6;
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
}
.perf button.on {
  border-color: #1f6fff;
  color: #fff;
  background: rgba(31, 111, 255, 0.25);
}
</style>
