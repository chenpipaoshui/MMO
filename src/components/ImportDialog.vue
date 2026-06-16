<script setup lang="ts">
import { ref } from 'vue'
import { getPdfPageCount, isPdfFile } from '../core/mapLoader'
import { PAPER_SIZES } from '../core/paper'
import { useProjectStore } from '../stores/project'
import type { PaperSizeId } from '../types'

const open = defineModel<boolean>('open', { default: false })

const store = useProjectStore()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const paperSizeId = ref<PaperSizeId>('A4')
const pdfPageCount = ref(0)
const pdfPage = ref(1)
const loading = ref(false)
const error = ref('')

async function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  selectedFile.value = file ?? null
  error.value = ''
  pdfPageCount.value = 0
  pdfPage.value = 1

  if (file && isPdfFile(file)) {
    try {
      pdfPageCount.value = await getPdfPageCount(file)
    } catch {
      error.value = '无法读取 PDF 文件'
      selectedFile.value = null
    }
  }
}

function close() {
  open.value = false
  selectedFile.value = null
  error.value = ''
  paperSizeId.value = 'A4'
  pdfPageCount.value = 0
  pdfPage.value = 1
  if (fileInput.value) fileInput.value.value = ''
}

async function confirm() {
  if (!selectedFile.value) {
    error.value = '请选择地图文件'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await store.loadMap(selectedFile.value, paperSizeId.value, pdfPage.value)
    close()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="close"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-slate-800">导入地图</h2>
        <p class="mt-1 text-sm text-slate-500">支持 PNG / JPG / WEBP / PDF</p>

        <div class="mt-5 space-y-4">
          <label class="block text-sm">
            <span class="mb-1 block font-medium text-slate-700">地图文件</span>
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
              class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              @change="onFileChange"
            />
          </label>

          <label v-if="pdfPageCount > 1" class="block text-sm">
            <span class="mb-1 block font-medium text-slate-700">PDF 页码</span>
            <input
              v-model.number="pdfPage"
              type="number"
              min="1"
              :max="pdfPageCount"
              class="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <p class="mt-1 text-xs text-slate-400">共 {{ pdfPageCount }} 页，请输入要导入的页码</p>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium text-slate-700">图纸尺寸</span>
            <select
              v-model="paperSizeId"
              class="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option v-for="paper in PAPER_SIZES" :key="paper.id" :value="paper.id">
                {{ paper.label }}
              </option>
            </select>
            <p class="mt-1 text-xs text-slate-400">地图扫描或导出时所使用的纸张大小</p>
          </label>
        </div>

        <p v-if="error" class="mt-3 text-sm text-red-500">{{ error }}</p>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            :disabled="loading"
            @click="close"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="loading"
            @click="confirm"
          >
            {{ loading ? '导入中…' : '导入' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
