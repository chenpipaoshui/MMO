<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  draftImageRegion,
  exportMapAsJpeg,
  hitExportRegionCorner,
  normalizeImageRegion,
  resizeExportRegionByCorner,
  type ExportRegionCorner,
} from "../core/export";
import { formatLength } from "../core/geometry";
import {
  clampPointToImage,
  findLineHit,
  findNearestPointHit,
} from "../core/hitTest";
import {
  buildImagePyramidAsync,
  drawPyramidLevel,
  type ImagePyramid,
  type ImagePyramidBuildSignal,
} from "../core/imagePyramid";
import {
  clampZoom,
  createViewport,
  fitImageToCanvas,
  imageToScreen,
  screenToImage,
  type Viewport,
} from "../core/viewport";
import { useProjectStore } from "../stores/project";
import LineLabelsOverlay from "./LineLabelsOverlay.vue";
import type { ImageRegion, Point } from "../types";
import { DEFAULT_LINE_STROKE_WIDTH } from "../types";

const store = useProjectStore();
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const viewport = ref<Viewport>(createViewport());
const canvasSize = ref({ width: 0, height: 0 });

const isPanning = ref(false);
const panStart = ref<Point>({ x: 0, y: 0 });
const panOrigin = ref<Viewport>(createViewport());
const spacePressed = ref(false);
const lastMouse = ref<Point>({ x: 0, y: 0 });

const isDraggingPoint = ref(false);
const dragTarget = ref<{ lineId: string; pointIndex: number } | null>(null);
const hoverPoint = ref<{ lineId: string; pointIndex: number } | null>(null);

const isDraggingExportRegion = ref(false);
const exportRegionStart = ref<Point | null>(null);
const exportRegionEnd = ref<Point | null>(null);
const confirmedExportRegion = ref<ImageRegion | null>(null);
const draggingExportCorner = ref<ExportRegionCorner | null>(null);
const hoverExportCorner = ref<ExportRegionCorner | null>(null);
const exporting = ref(false);

let resizeObserver: ResizeObserver | null = null;
const imagePyramid = ref<ImagePyramid | null>(null);
let pyramidGeneration = 0;

async function rebuildImagePyramid(img: HTMLImageElement) {
  const generation = ++pyramidGeneration;
  imagePyramid.value?.dispose();
  imagePyramid.value = null;

  const signal: ImagePyramidBuildSignal = {
    get cancelled() {
      return generation !== pyramidGeneration;
    },
  };

  try {
    const pyramid = await buildImagePyramidAsync(
      img,
      img.width,
      img.height,
      signal,
    );
    if (generation !== pyramidGeneration) {
      pyramid.dispose();
      return;
    }
    imagePyramid.value = pyramid;
    draw();
  } catch {
    // cancelled or failed — fall back to direct drawImage
  }
}

function disposeImagePyramid() {
  pyramidGeneration++;
  imagePyramid.value?.dispose();
  imagePyramid.value = null;
}

function getCanvasPoint(event: MouseEvent): Point {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function resizeCanvas() {
  const container = containerRef.value;
  const canvas = canvasRef.value;
  if (!container || !canvas) return;

  const { clientWidth, clientHeight } = container;
  canvasSize.value = { width: clientWidth, height: clientHeight };
  canvas.width = clientWidth;
  canvas.height = clientHeight;
  draw();
}

function draw() {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, width, height);

  const img = store.image;
  if (img) {
    const vp = viewport.value;
    ctx.save();
    ctx.translate(vp.offsetX, vp.offsetY);
    ctx.scale(vp.zoom, vp.zoom);

    const pyramid = imagePyramid.value;
    if (pyramid && vp.zoom < 1) {
      const level = pyramid.getLevelForZoom(vp.zoom);
      drawPyramidLevel(ctx, pyramid, img, level);
    } else {
      ctx.imageSmoothingEnabled = vp.zoom < 1;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0);
    }

    ctx.restore();

    drawLines(ctx, vp);
    drawDraft(ctx, vp);
    drawExportRegionOverlay(ctx, vp);
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("请先上传地图图片", width / 2, height / 2);
  }
}

function isPointHighlighted(lineId: string, pointIndex: number): boolean {
  if (
    dragTarget.value?.lineId === lineId &&
    dragTarget.value.pointIndex === pointIndex
  )
    return true;
  if (
    hoverPoint.value?.lineId === lineId &&
    hoverPoint.value.pointIndex === pointIndex
  )
    return true;
  return false;
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  points: Point[],
  color: string,
  lineId: string,
  strokeWidth: number,
  showVertices: boolean,
) {
  if (points.length === 0) return;

  ctx.save();
  ctx.translate(vp.offsetX, vp.offsetY);
  ctx.scale(vp.zoom, vp.zoom);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  if (showVertices) {
    const outlineWidth = 2 / vp.zoom;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const highlighted = isPointHighlighted(lineId, i);
      const radius = highlighted ? 7 : 6;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
    }
  }
  ctx.restore();
}

function drawLines(ctx: CanvasRenderingContext2D, vp: Viewport) {
  const visible = store.lines.filter((l) => l.visible);
  const unselected = visible.filter((l) => l.id !== store.selectedLineId);
  const selected = visible.filter((l) => l.id === store.selectedLineId);

  for (const line of unselected) {
    drawPolyline(
      ctx,
      vp,
      line.points,
      line.color,
      line.id,
      line.strokeWidth,
      false,
    );
  }
  for (const line of selected) {
    drawPolyline(
      ctx,
      vp,
      line.points,
      line.color,
      line.id,
      line.strokeWidth,
      true,
    );
  }
}

function drawDraft(ctx: CanvasRenderingContext2D, vp: Viewport) {
  const points = store.draftPoints;
  if (points.length === 0) return;

  drawPolyline(
    ctx,
    vp,
    points,
    "#2563eb",
    "__draft__",
    DEFAULT_LINE_STROKE_WIDTH,
    true,
  );

  if (points.length >= 1) {
    const labelPos = imageToScreen(points[points.length - 1], vp);

    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }

    const realLen =
      store.metersPerPixel !== null ? len * store.metersPerPixel : null;
    const text = `绘制中: ${formatLength(realLen, "m")} (${len.toFixed(1)} px)`;

    ctx.save();
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    const padding = 6;
    const textW = ctx.measureText(text).width;
    ctx.fillRect(labelPos.x + 10, labelPos.y - 24, textW + padding * 2, 22);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, labelPos.x + 10 + padding, labelPos.y - 9);
    ctx.restore();
  }
}

function getExportDisplayRegion(): ImageRegion | null {
  if (confirmedExportRegion.value) return confirmedExportRegion.value;
  if (
    !store.exportSelecting ||
    !exportRegionStart.value ||
    !exportRegionEnd.value ||
    !store.image
  ) {
    return null;
  }
  return draftImageRegion(
    exportRegionStart.value,
    exportRegionEnd.value,
    store.image.width,
    store.image.height,
  );
}

function drawExportRegionOverlay(ctx: CanvasRenderingContext2D, vp: Viewport) {
  const region = getExportDisplayRegion();
  if (!region || region.width <= 0 || region.height <= 0) return;

  const p1 = imageToScreen({ x: region.x, y: region.y }, vp);
  const p2 = imageToScreen(
    { x: region.x + region.width, y: region.y + region.height },
    vp,
  );
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const w = Math.abs(p2.x - p1.x);
  const h = Math.abs(p2.y - p1.y);

  ctx.save();
  ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  if (confirmedExportRegion.value) {
    const handleSize = 8;
    const corners = [
      { x: region.x, y: region.y },
      { x: region.x + region.width, y: region.y },
      { x: region.x, y: region.y + region.height },
      { x: region.x + region.width, y: region.y + region.height },
    ];
    for (const pt of corners) {
      const s = imageToScreen(pt, vp);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.fillRect(
        s.x - handleSize / 2,
        s.y - handleSize / 2,
        handleSize,
        handleSize,
      );
      ctx.strokeRect(
        s.x - handleSize / 2,
        s.y - handleSize / 2,
        handleSize,
        handleSize,
      );
    }
  }
  ctx.restore();
}

function exportCornerCursor(corner: ExportRegionCorner | null): string {
  if (!corner) return "";
  return corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize";
}

function updateExportCornerHover(screenPoint: Point) {
  if (
    !store.exportSelecting ||
    !confirmedExportRegion.value ||
    draggingExportCorner.value
  ) {
    hoverExportCorner.value = null;
    return;
  }
  hoverExportCorner.value = hitExportRegionCorner(
    screenPoint,
    confirmedExportRegion.value,
    viewport.value,
    Math.max(10, 10 * viewport.value.zoom),
  );
}

function resetExportRegionDraft() {
  exportRegionStart.value = null;
  exportRegionEnd.value = null;
  confirmedExportRegion.value = null;
  draggingExportCorner.value = null;
  hoverExportCorner.value = null;
}

function clearExportSelection() {
  resetExportRegionDraft();
  isDraggingExportRegion.value = false;
  store.cancelExportSelection();
  draw();
}

async function confirmRegionExport() {
  if (!store.image || !confirmedExportRegion.value) return;
  exporting.value = true;
  try {
    await exportMapAsJpeg(
      store.image,
      store.lines,
      store.imageName,
      confirmedExportRegion.value,
    );
    clearExportSelection();
  } catch (err) {
    alert(err instanceof Error ? err.message : "导出失败");
  } finally {
    exporting.value = false;
  }
}

function reselectExportRegion() {
  confirmedExportRegion.value = null;
  exportRegionStart.value = null;
  exportRegionEnd.value = null;
  draggingExportCorner.value = null;
  hoverExportCorner.value = null;
  draw();
}

function fitImage() {
  const img = store.image;
  if (!img || canvasSize.value.width === 0) return;
  viewport.value = fitImageToCanvas(
    img.width,
    img.height,
    canvasSize.value.width,
    canvasSize.value.height,
  );
  draw();
}

function shouldPan(event: MouseEvent): boolean {
  return store.activeTool === "pan" || spacePressed.value || event.button === 1;
}

function selectableLines() {
  if (!store.selectedLineId) return [];
  const line = store.lines.find((l) => l.id === store.selectedLineId);
  return line?.visible ? [line] : [];
}

function updateHoverPoint(screenPoint: Point) {
  if (
    store.activeTool !== "select" ||
    isDraggingPoint.value ||
    !store.image ||
    !store.selectedLineId
  ) {
    hoverPoint.value = null;
    return;
  }
  const hit = findNearestPointHit(
    screenPoint,
    selectableLines(),
    viewport.value,
    store.selectedLineId,
  );
  hoverPoint.value = hit
    ? { lineId: hit.lineId, pointIndex: hit.pointIndex }
    : null;
}

function onMouseDown(event: MouseEvent) {
  if (!store.image) return;
  const point = getCanvasPoint(event);

  if (shouldPan(event)) {
    isPanning.value = true;
    panStart.value = point;
    panOrigin.value = { ...viewport.value };
    event.preventDefault();
    bindWindowPointerHandlers();
    return;
  }

  if (store.exportSelecting && event.button === 0) {
    if (confirmedExportRegion.value) {
      const corner = hitExportRegionCorner(
        point,
        confirmedExportRegion.value,
        viewport.value,
        Math.max(10, 10 * viewport.value.zoom),
      );
      if (corner) {
        draggingExportCorner.value = corner;
        bindWindowPointerHandlers();
        event.preventDefault();
        return;
      }
      return;
    }

    const imagePoint = clampPointToImage(
      screenToImage(point, viewport.value),
      store.image.width,
      store.image.height,
    );
    isDraggingExportRegion.value = true;
    exportRegionStart.value = imagePoint;
    exportRegionEnd.value = imagePoint;
    bindWindowPointerHandlers();
    event.preventDefault();
    return;
  }

  if (store.activeTool === "select" && event.button === 0) {
    const pointHit = findNearestPointHit(
      point,
      selectableLines(),
      viewport.value,
      store.selectedLineId,
    );
    if (pointHit) {
      store.selectLine(pointHit.lineId);
      isDraggingPoint.value = true;
      dragTarget.value = {
        lineId: pointHit.lineId,
        pointIndex: pointHit.pointIndex,
      };
      event.preventDefault();
      bindWindowPointerHandlers();
      return;
    }

    const lineHit = findLineHit(point, store.lines, viewport.value);
    if (lineHit) {
      store.selectLine(lineHit);
      return;
    }

    store.selectLine(null);
    return;
  }

  if (store.activeTool === "polyline" && event.button === 0) {
    const imagePoint = screenToImage(point, viewport.value);
    store.addDraftPoint(imagePoint);
    draw();
  }
}

function handlePointerMove(event: MouseEvent) {
  lastMouse.value = getCanvasPoint(event);

  if (
    draggingExportCorner.value &&
    confirmedExportRegion.value &&
    store.image
  ) {
    const imagePoint = clampPointToImage(
      screenToImage(lastMouse.value, viewport.value),
      store.image.width,
      store.image.height,
    );
    confirmedExportRegion.value = resizeExportRegionByCorner(
      confirmedExportRegion.value,
      draggingExportCorner.value,
      imagePoint,
      store.image.width,
      store.image.height,
    );
    draw();
    return;
  }

  if (isDraggingExportRegion.value && exportRegionStart.value && store.image) {
    exportRegionEnd.value = clampPointToImage(
      screenToImage(lastMouse.value, viewport.value),
      store.image.width,
      store.image.height,
    );
    draw();
    return;
  }

  if (isDraggingPoint.value && dragTarget.value && store.image) {
    const imagePoint = screenToImage(lastMouse.value, viewport.value);
    const clamped = clampPointToImage(
      imagePoint,
      store.image.width,
      store.image.height,
    );
    store.updateLinePoint(
      dragTarget.value.lineId,
      dragTarget.value.pointIndex,
      clamped,
    );
    draw();
    return;
  }

  if (isPanning.value) {
    const dx = lastMouse.value.x - panStart.value.x;
    const dy = lastMouse.value.y - panStart.value.y;
    viewport.value = {
      ...viewport.value,
      offsetX: panOrigin.value.offsetX + dx,
      offsetY: panOrigin.value.offsetY + dy,
    };
    draw();
    return;
  }

  updateHoverPoint(lastMouse.value);
  draw();
}

function endPointerInteraction() {
  const wasDragging = isDraggingPoint.value;
  const wasExportDragging = isDraggingExportRegion.value;
  const wasCornerDragging = draggingExportCorner.value !== null;

  if (wasCornerDragging) {
    draggingExportCorner.value = null;
    unbindWindowPointerHandlers();
    draw();
    return;
  }

  if (
    wasExportDragging &&
    exportRegionStart.value &&
    exportRegionEnd.value &&
    store.image
  ) {
    confirmedExportRegion.value = normalizeImageRegion(
      exportRegionStart.value,
      exportRegionEnd.value,
      store.image.width,
      store.image.height,
    );
    isDraggingExportRegion.value = false;
    exportRegionStart.value = null;
    exportRegionEnd.value = null;
    unbindWindowPointerHandlers();
    draw();
    return;
  }

  isPanning.value = false;
  isDraggingPoint.value = false;
  dragTarget.value = null;
  unbindWindowPointerHandlers();
  if (wasDragging) draw();
}

function bindWindowPointerHandlers() {
  unbindWindowPointerHandlers();
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", endPointerInteraction);
}

function unbindWindowPointerHandlers() {
  window.removeEventListener("mousemove", handlePointerMove);
  window.removeEventListener("mouseup", endPointerInteraction);
}

function onMouseMove(event: MouseEvent) {
  if (
    isDraggingPoint.value ||
    isPanning.value ||
    isDraggingExportRegion.value ||
    draggingExportCorner.value
  ) {
    return;
  }
  lastMouse.value = getCanvasPoint(event);
  if (store.exportSelecting && confirmedExportRegion.value) {
    updateExportCornerHover(lastMouse.value);
    draw();
    return;
  }
  updateHoverPoint(lastMouse.value);
  draw();
}

function onMouseUp() {
  if (isDraggingExportRegion.value || draggingExportCorner.value) {
    endPointerInteraction();
    return;
  }
  if (!isDraggingPoint.value && !isPanning.value) return;
  endPointerInteraction();
}

function onWheel(event: WheelEvent) {
  if (!store.image) return;
  event.preventDefault();

  const point = getCanvasPoint(event);
  const vp = viewport.value;
  const imagePoint = screenToImage(point, vp);
  const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
  const newZoom = clampZoom(vp.zoom * factor);

  viewport.value = {
    zoom: newZoom,
    offsetX: point.x - imagePoint.x * newZoom,
    offsetY: point.y - imagePoint.y * newZoom,
  };
  draw();
}

function onDoubleClick(event: MouseEvent) {
  if (store.activeTool !== "polyline" || !store.image) return;
  event.preventDefault();
  if (store.draftPoints.length > 0) {
    store.undoDraftPoint();
  }
  store.finishDraft();
  store.setActiveTool("select");
  draw();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.code === "Space" && !spacePressed.value) {
    spacePressed.value = true;
    event.preventDefault();
  }
  if (event.key === "Escape") {
    if (store.exportSelecting) {
      clearExportSelection();
      event.preventDefault();
      return;
    }
    store.clearDraft();
    isDraggingPoint.value = false;
    dragTarget.value = null;
    draw();
  }
  if (event.key === "Enter" && store.activeTool === "polyline") {
    store.finishDraft();
    store.setActiveTool("select");
    draw();
  }
  if (event.key === "Backspace" && store.activeTool === "polyline") {
    store.undoDraftPoint();
    draw();
    event.preventDefault();
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code === "Space") {
    spacePressed.value = false;
  }
}

function onContextMenu(event: MouseEvent) {
  if (shouldPan(event)) event.preventDefault();
}

watch(
  () => [
    store.lines,
    store.selectedLineId,
    store.draftPoints,
    store.image,
    store.activeTool,
  ],
  () => draw(),
  { deep: true },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeCanvas);
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  resizeCanvas();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  unbindWindowPointerHandlers();
  disposeImagePyramid();
});

watch(
  () => store.exportSelecting,
  (selecting) => {
    if (selecting) resetExportRegionDraft();
  },
);

watch(
  () => store.image,
  (img) => {
    disposeImagePyramid();
    if (img) {
      rebuildImagePyramid(img);
      fitImage();
    }
  },
);
</script>

<template>
  <div
    ref="containerRef"
    data-canvas-root
    class="relative h-full w-full overflow-hidden"
    :class="[
      isPanning || spacePressed || store.activeTool === 'pan'
        ? 'cursor-grabbing'
        : '',
      store.activeTool === 'polyline' && !spacePressed
        ? 'cursor-crosshair'
        : '',
      store.activeTool === 'pan' && !isPanning ? 'cursor-grab' : '',
      store.activeTool === 'select' && isDraggingPoint ? 'cursor-grabbing' : '',
      store.activeTool === 'select' && !isDraggingPoint && hoverPoint
        ? 'cursor-grab'
        : '',
      store.exportSelecting && !confirmedExportRegion ? 'cursor-crosshair' : '',
      store.exportSelecting && (draggingExportCorner || hoverExportCorner)
        ? exportCornerCursor(draggingExportCorner || hoverExportCorner)
        : '',
    ]"
    :style="
      store.exportSelecting && (draggingExportCorner || hoverExportCorner)
        ? {
            cursor: exportCornerCursor(
              draggingExportCorner || hoverExportCorner,
            ),
          }
        : undefined
    "
  >
    <canvas
      ref="canvasRef"
      class="block h-full w-full"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @wheel="onWheel"
      @dblclick="onDoubleClick"
      @contextmenu="onContextMenu"
    />
    <LineLabelsOverlay v-if="store.image" :viewport="viewport" />

    <div
      v-if="store.exportSelecting && confirmedExportRegion"
      class="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-lg"
    >
      拖动四角白点调整选区，按住空格可平移地图
    </div>

    <div
      v-if="store.exportSelecting && !confirmedExportRegion"
      class="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-lg"
    >
      拖动鼠标框选导出区域，按住空格可平移地图，Esc 取消
    </div>

    <div
      v-if="confirmedExportRegion"
      class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg"
    >
      <span class="text-xs text-slate-500">
        已选 {{ confirmedExportRegion.width }} ×
        {{ confirmedExportRegion.height }} px
      </span>
      <button
        type="button"
        class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        :disabled="exporting"
        @click="confirmRegionExport"
      >
        {{ exporting ? "导出中…" : "确认导出 JPG" }}
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        @click="reselectExportRegion"
      >
        重新框选
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        @click="clearExportSelection"
      >
        取消
      </button>
    </div>
  </div>
</template>
