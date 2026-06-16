<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { formatLineLabelText } from '../core/geometry'
import { clampPointToImage } from '../core/hitTest'
import { imageToScreen, screenToImage, type Viewport } from '../core/viewport'
import { useProjectStore } from '../stores/project'

const props = defineProps<{
  viewport: Viewport
}>()

const store = useProjectStore()

const isDraggingLabel = ref(false)
const dragLabelLineId = ref<string | null>(null)
const dragLabelOffset = ref({ x: 0, y: 0 })

const visibleLines = computed(() => store.lines.filter((l) => l.visible))

const labelsInteractive = computed(() => !store.exportSelecting)

function labelText(line: (typeof store.lines)[number]) {
  return formatLineLabelText(line.pixelLength, line.realLengthMeters)
}

function labelStyle(line: (typeof store.lines)[number]) {
  const screen = imageToScreen(line.labelPosition, props.viewport)
  const fontSize = line.labelFontSize * props.viewport.zoom
  return {
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    fontSize: `${fontSize}px`,
    color: line.color,
  }
}

function onLabelMouseDown(lineId: string, event: MouseEvent) {
  if (store.activeTool !== 'select' || event.button !== 0) return

  const line = store.lines.find((l) => l.id === lineId)
  if (!line) return

  store.selectLine(lineId)

  const canvas = (event.currentTarget as HTMLElement).closest('[data-canvas-root]') as HTMLElement | null
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const screenX = event.clientX - rect.left
  const screenY = event.clientY - rect.top
  const labelScreen = imageToScreen(line.labelPosition, props.viewport)

  isDraggingLabel.value = true
  dragLabelLineId.value = lineId
  dragLabelOffset.value = {
    x: screenX - labelScreen.x,
    y: screenY - labelScreen.y,
  }

  event.preventDefault()
  bindWindowHandlers()
}

function handleWindowMove(event: MouseEvent) {
  if (!isDraggingLabel.value || !dragLabelLineId.value || !store.image) return

  const canvas = document.querySelector('[data-canvas-root]') as HTMLElement | null
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const screenX = event.clientX - rect.left - dragLabelOffset.value.x
  const screenY = event.clientY - rect.top - dragLabelOffset.value.y
  const imagePoint = screenToImage({ x: screenX, y: screenY }, props.viewport)
  const clamped = clampPointToImage(imagePoint, store.image.width, store.image.height)
  store.updateLineLabelPosition(dragLabelLineId.value, clamped)
}

function endDrag() {
  isDraggingLabel.value = false
  dragLabelLineId.value = null
  unbindWindowHandlers()
}

function bindWindowHandlers() {
  unbindWindowHandlers()
  window.addEventListener('mousemove', handleWindowMove)
  window.addEventListener('mouseup', endDrag)
}

function unbindWindowHandlers() {
  window.removeEventListener('mousemove', handleWindowMove)
  window.removeEventListener('mouseup', endDrag)
}

function onLabelWheel(lineId: string, event: WheelEvent) {
  if (store.activeTool !== 'select') return
  event.preventDefault()
  event.stopPropagation()

  const line = store.lines.find((l) => l.id === lineId)
  if (!line) return

  store.selectLine(lineId)
  const delta = event.deltaY < 0 ? 1 : -1
  store.updateLineLabelFontSize(lineId, line.labelFontSize + delta)
}

onUnmounted(() => {
  unbindWindowHandlers()
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      v-for="line in visibleLines"
      :key="line.id"
      class="absolute max-w-none select-none whitespace-nowrap font-semibold leading-tight"
      :class="[
        labelsInteractive ? 'pointer-events-auto' : 'pointer-events-none',
        store.activeTool === 'select' && labelsInteractive ? 'cursor-move' : 'cursor-default',
        isDraggingLabel && dragLabelLineId === line.id ? 'opacity-80' : '',
      ]"
      :style="labelStyle(line)"
      @mousedown.stop="onLabelMouseDown(line.id, $event)"
      @wheel="onLabelWheel(line.id, $event)"
      :title="store.activeTool === 'select' ? '拖动移动 · 滚轮调整字号' : ''"
    >
      {{ labelText(line) }}
    </div>
  </div>
</template>
