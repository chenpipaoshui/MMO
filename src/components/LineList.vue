<script setup lang="ts">
import { computed, ref } from 'vue'
import ColorPickerDialog from './ColorPickerDialog.vue'
import { formatLength } from '../core/geometry'
import { useProjectStore } from '../stores/project'
import { MAX_LABEL_FONT_SIZE, MIN_LABEL_FONT_SIZE, MAX_LINE_STROKE_WIDTH, MIN_LINE_STROKE_WIDTH } from '../types'

const store = useProjectStore()

const sortedLines = computed(() => [...store.lines].reverse())

const selectedLine = computed(() =>
  store.selectedLineId ? store.lines.find((l) => l.id === store.selectedLineId) : null,
)

const colorDialogOpen = ref(false)
const colorDialogLineId = ref<string | null>(null)
const colorDialogInitial = ref('#3b82f6')

function selectLine(id: string) {
  store.selectLine(id)
  if (store.activeTool === 'polyline') {
    store.setActiveTool('select')
  }
}

function setColor(lineId: string, color: string) {
  store.setLineColor(lineId, color)
}

function openColorDialog(lineId: string, currentColor: string) {
  selectLine(lineId)
  colorDialogLineId.value = lineId
  colorDialogInitial.value = currentColor
  colorDialogOpen.value = true
}

function onColorConfirm(color: string) {
  if (colorDialogLineId.value) {
    setColor(colorDialogLineId.value, color)
    store.addCustomColor(color)
  }
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
    <ColorPickerDialog
      v-model:open="colorDialogOpen"
      :initial-color="colorDialogInitial"
      @confirm="onColorConfirm"
    />

    <div class="border-b border-slate-200 px-4 py-3">
      <h2 class="text-sm font-semibold text-slate-800">线段列表</h2>
      <p class="mt-1 text-xs text-slate-500">共 {{ store.lines.length }} 条</p>
    </div>

    <div
      v-if="selectedLine"
      class="border-b border-slate-200 bg-slate-50 px-4 py-3"
      @click.stop
    >
      <p class="mb-2 text-xs font-medium text-slate-600">
        线段颜色
        <span class="font-normal text-slate-400">（当前选中）</span>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="color in store.paletteColors"
          :key="color"
          type="button"
          class="h-6 w-6 rounded-full border-2 transition hover:scale-110"
          :class="selectedLine.color === color ? 'border-slate-800' : 'border-transparent'"
          :style="{ backgroundColor: color }"
          :title="color"
          @click.stop="setColor(selectedLine.id, color)"
        />
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
          title="自定义颜色"
          @click.stop="openColorDialog(selectedLine.id, selectedLine.color)"
        >
          +
        </button>
      </div>
      <p class="mt-2 text-xs text-slate-400">预设色点击即生效；「+」添加自定义色并加入色板</p>

      <div class="mt-4 border-t border-slate-200 pt-3">
        <label class="block text-xs font-medium text-slate-600">
          线段粗细
          <span class="font-normal text-slate-400">（{{ selectedLine.strokeWidth }} px）</span>
        </label>
        <input
          type="range"
          class="mt-2 w-full accent-blue-600"
          :min="MIN_LINE_STROKE_WIDTH"
          :max="MAX_LINE_STROKE_WIDTH"
          :value="selectedLine.strokeWidth"
          @input="store.updateLineStrokeWidth(selectedLine.id, Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="mt-4 border-t border-slate-200 pt-3">
        <label class="block text-xs font-medium text-slate-600">
          长度标签字号
          <span class="font-normal text-slate-400">（{{ selectedLine.labelFontSize }} px）</span>
        </label>
        <input
          type="range"
          class="mt-2 w-full accent-blue-600"
          :min="MIN_LABEL_FONT_SIZE"
          :max="MAX_LABEL_FONT_SIZE"
          :value="selectedLine.labelFontSize"
          @input="store.updateLineLabelFontSize(selectedLine.id, Number(($event.target as HTMLInputElement).value))"
        />
        <p class="mt-1 text-xs text-slate-400">地图上选中标签后滚轮也可调整字号</p>
      </div>
    </div>

    <div v-if="sortedLines.length === 0" class="flex flex-1 items-center justify-center p-6 text-sm text-slate-400">
      暂无线段，使用折线工具在地图上绘制
    </div>

    <ul v-else class="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
      <li
        v-for="(line, index) in sortedLines"
        :key="line.id"
        class="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-slate-50"
        :class="store.selectedLineId === line.id ? 'bg-blue-50' : ''"
        @click="selectLine(line.id)"
      >
        <button
          type="button"
          class="relative mt-0.5 h-5 w-5 shrink-0 rounded-full ring-2 ring-offset-1"
          :class="store.selectedLineId === line.id ? 'ring-blue-400' : 'ring-transparent'"
          :style="{ backgroundColor: line.color, opacity: line.visible ? 1 : 0.3 }"
          title="修改颜色"
          @click.stop="openColorDialog(line.id, line.color)"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-slate-800">线段 {{ store.lines.length - index }}</span>
            <span class="text-sm font-semibold text-blue-600">
              {{ formatLength(line.realLengthMeters, 'm') }}
            </span>
          </div>
          <p class="text-xs text-slate-500">{{ line.pixelLength.toFixed(1) }} px · {{ line.points.length }} 点</p>
        </div>
        <div class="flex shrink-0 gap-1">
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            :title="line.visible ? '隐藏' : '显示'"
            @click.stop="store.toggleLineVisibility(line.id)"
          >
            {{ line.visible ? '隐藏' : '显示' }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            @click.stop="store.removeLine(line.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>

    <div class="border-t border-slate-200 px-4 py-3">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium text-slate-700">合计</span>
        <span class="text-lg font-bold text-blue-600">{{ formatLength(store.totalRealLength, 'm') }}</span>
      </div>
    </div>
  </section>
</template>
