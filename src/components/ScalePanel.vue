<script setup lang="ts">
import { ref, watch } from 'vue'
import { PAPER_SIZES } from '../core/paper'
import { useProjectStore } from '../stores/project'
import { DEFAULT_MAP_SCALE_DENOMINATOR, type PaperSizeId } from '../types'

const store = useProjectStore()
const scaleInput = ref(String(DEFAULT_MAP_SCALE_DENOMINATOR))

watch(
  () => store.mapScaleDenominator,
  (value) => {
    scaleInput.value = value === null ? '' : String(value)
  },
  { immediate: true },
)

function onPaperSizeChange(event: Event) {
  store.setPaperSizeId((event.target as HTMLSelectElement).value as PaperSizeId)
}

function onScaleInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim()
  scaleInput.value = raw
  if (raw === '') {
    store.setMapScaleDenominator(null)
    return
  }
  const num = Number(raw)
  if (!Number.isFinite(num) || num <= 0) {
    store.setMapScaleDenominator(null)
    return
  }
  store.setMapScaleDenominator(num)
}

const scaleInvalid = () => {
  if (scaleInput.value === '') return false
  const num = Number(scaleInput.value)
  return !Number.isFinite(num) || num <= 0
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold text-slate-800">比例尺设置</h2>

    <div v-if="!store.image" class="text-sm text-slate-400">
      请先上传地图并选择纸张尺寸
    </div>

    <div v-else class="space-y-4 text-sm">
      <label class="block">
        <span class="mb-1 block text-slate-600">图纸尺寸</span>
        <select
          class="w-full rounded border border-slate-300 px-2 py-1.5"
          :value="store.paperSizeId ?? 'A4'"
          @change="onPaperSizeChange"
        >
          <option v-for="paper in PAPER_SIZES" :key="paper.id" :value="paper.id">
            {{ paper.label }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="mb-1 block text-slate-600">地图比例尺</span>
        <div class="flex items-center gap-2">
          <span class="shrink-0 text-slate-700">1 :</span>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="4000"
            class="min-w-0 flex-1 rounded border px-2 py-1.5"
            :class="scaleInvalid() ? 'border-red-400 bg-red-50' : 'border-slate-300'"
            :value="scaleInput"
            @input="onScaleInput"
          />
        </div>
        <p class="mt-1 text-xs text-slate-400">默认 1:4000，表示图上 1 mm 对应实地 4 m</p>
      </label>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      <template v-if="store.scale">
        当前：{{ store.paperSizeId }} · 1:{{ store.mapScaleDenominator }} · 1 px ≈
        {{ store.metersPerPixel!.toPrecision(4) }} m
      </template>
      <template v-else-if="store.image">请填写有效的地图比例尺</template>
      <template v-else>未设置有效比例尺，仅显示像素长度</template>
    </p>
  </section>
</template>
