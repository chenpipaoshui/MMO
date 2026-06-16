<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  exportFull: []
  exportRegion: []
}>()

function close() {
  open.value = false
}

function chooseFull() {
  emit('exportFull')
  close()
}

function chooseRegion() {
  emit('exportRegion')
  close()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="close"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-slate-800">导出地图</h2>
        <p class="mt-1 text-sm text-slate-500">导出为 JPG，包含地图、线段与长度标注</p>

        <div class="mt-5 space-y-3">
          <button
            type="button"
            class="w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
            @click="chooseFull"
          >
            <span class="block text-sm font-medium text-slate-800">原尺寸全图</span>
            <span class="mt-0.5 block text-xs text-slate-500">按地图原始像素尺寸导出完整图片</span>
          </button>

          <button
            type="button"
            class="w-full rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
            @click="chooseRegion"
          >
            <span class="block text-sm font-medium text-slate-800">框选区域</span>
            <span class="mt-0.5 block text-xs text-slate-500">在地图上拖动框选，导出选中区域（原尺寸）</span>
          </button>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            @click="close"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
