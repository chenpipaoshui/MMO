<script setup lang="ts">
import { ref } from "vue";
import ExportDialog from "./ExportDialog.vue";
import ImportDialog from "./ImportDialog.vue";
import { exportMapAsJpeg } from "../core/export";
import { useProjectStore } from "../stores/project";
import type { ToolMode } from "../types";

const store = useProjectStore();
const importOpen = ref(false);
const exportOpen = ref(false);
const exporting = ref(false);

const tools: { id: ToolMode; label: string; hint: string }[] = [
  { id: "select", label: "编辑", hint: "选中线段、拖动顶点、修改颜色" },
  { id: "pan", label: "平移", hint: "拖拽移动画布" },
  { id: "polyline", label: "折线", hint: "点击落点，双击或 Enter 结束" },
];

function setTool(tool: ToolMode) {
  store.setActiveTool(tool);
}

async function onExportFull() {
  if (!store.image) {
    alert("请先上传地图");
    return;
  }
  exporting.value = true;
  try {
    await exportMapAsJpeg(store.image, store.lines, store.imageName);
  } catch (err) {
    alert(err instanceof Error ? err.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function onExportRegion() {
  if (!store.image) {
    alert("请先上传地图");
    return;
  }
  store.startExportRegionSelection();
}
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
  >
    <div class="flex items-center gap-2">
      <h1 class="text-lg font-bold text-slate-800">MMO</h1>
      <span
        v-if="store.imageName"
        class="max-w-[200px] truncate text-xs text-slate-500"
        >{{ store.imageName }}</span
      >
      <span
        v-if="store.paperSizeId"
        class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
      >
        {{ store.paperSizeId }}
      </span>
    </div>

    <div class="mx-2 hidden h-6 w-px bg-slate-200 sm:block" />

    <button
      type="button"
      class="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
      @click="importOpen = true"
    >
      上传地图
    </button>

    <button
      type="button"
      class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      :disabled="!store.image || exporting"
      @click="exportOpen = true"
    >
      {{ exporting ? "导出中…" : "导出" }}
    </button>

    <ImportDialog v-model:open="importOpen" />
    <ExportDialog
      v-model:open="exportOpen"
      @export-full="onExportFull"
      @export-region="onExportRegion"
    />

    <div class="flex rounded-lg border border-slate-200 p-0.5">
      <button
        v-for="tool in tools"
        :key="tool.id"
        type="button"
        class="rounded-md px-3 py-1.5 text-sm transition"
        :class="
          store.activeTool === tool.id
            ? 'bg-blue-600 text-white'
            : 'text-slate-600 hover:bg-slate-100'
        "
        :title="tool.hint"
        @click="setTool(tool.id)"
      >
        {{ tool.label }}
      </button>
    </div>

    <p class="ml-auto hidden text-xs text-slate-500 md:block">
      滚轮缩放 · 编辑拖动顶点/标签 · 导出 JPG
    </p>
  </header>
</template>
