import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { mergePaletteColors, nextLineColor, normalizeColorHex, PRESET_LINE_COLORS } from '../core/colors'
import { defaultLabelPosition, pixelToRealLength, polylinePixelLength } from '../core/geometry'
import { loadMapFileAsImage } from '../core/mapLoader'
import { computeMetersPerPixelFromMapScale, getPaperSize } from '../core/paper'
import type { MeasureLine, PaperSizeId, Point, Scale, ToolMode } from '../types'
import { DEFAULT_LABEL_FONT_SIZE, DEFAULT_LINE_STROKE_WIDTH, DEFAULT_MAP_SCALE_DENOMINATOR, MAX_LABEL_FONT_SIZE, MIN_LABEL_FONT_SIZE, MAX_LINE_STROKE_WIDTH, MIN_LINE_STROKE_WIDTH } from '../types'

function createLine(points: Point[], color: string, metersPerPixel: number | null): MeasureLine {
  const pixelLength = polylinePixelLength(points)
  return {
    id: crypto.randomUUID(),
    type: 'polyline',
    points,
    color,
    pixelLength,
    realLengthMeters: metersPerPixel !== null ? pixelToRealLength(pixelLength, metersPerPixel) : null,
    visible: true,
    labelPosition: defaultLabelPosition(points),
    labelFontSize: DEFAULT_LABEL_FONT_SIZE,
    strokeWidth: DEFAULT_LINE_STROKE_WIDTH,
  }
}

export const useProjectStore = defineStore('project', () => {
  const image = ref<HTMLImageElement | null>(null)
  const imageName = ref('')
  const paperSizeId = ref<PaperSizeId | null>(null)
  const mapScaleDenominator = ref<number | null>(null)
  const lines = ref<MeasureLine[]>([])
  const activeTool = ref<ToolMode>('select')
  const selectedLineId = ref<string | null>(null)
  const draftPoints = ref<Point[]>([])
  const customColors = ref<string[]>([])
  const exportSelecting = ref(false)

  const paletteColors = computed(() => mergePaletteColors(PRESET_LINE_COLORS, customColors.value))

  const metersPerPixel = computed(() => {
    const img = image.value
    if (!img || paperSizeId.value === null || mapScaleDenominator.value === null) return null
    return computeMetersPerPixelFromMapScale(
      img.width,
      img.height,
      getPaperSize(paperSizeId.value),
      mapScaleDenominator.value,
    )
  })

  const scale = computed<Scale | null>(() => {
    if (metersPerPixel.value === null || paperSizeId.value === null || mapScaleDenominator.value === null) {
      return null
    }
    return {
      paperSizeId: paperSizeId.value,
      mapScaleDenominator: mapScaleDenominator.value,
      metersPerPixel: metersPerPixel.value,
    }
  })

  const totalRealLength = computed(() => {
    const valid = lines.value.filter((l) => l.visible && l.realLengthMeters !== null)
    if (valid.length === 0) return null
    return valid.reduce((sum, l) => sum + (l.realLengthMeters ?? 0), 0)
  })

  function setPaperSizeId(id: PaperSizeId) {
    paperSizeId.value = id
    recalculateAllLines()
  }

  function setMapScaleDenominator(value: number | null) {
    mapScaleDenominator.value = value
    recalculateAllLines()
  }

  function recalculateAllLines() {
    const mpp = metersPerPixel.value
    lines.value = lines.value.map((line) => {
      const pixelLength = polylinePixelLength(line.points)
      return {
        ...line,
        pixelLength,
        realLengthMeters: mpp !== null ? pixelToRealLength(pixelLength, mpp) : null,
      }
    })
  }

  function loadMap(file: File, sizeId: PaperSizeId, pdfPage = 1) {
    return loadMapFileAsImage(file, pdfPage, sizeId)
      .then((img) => {
        image.value = img
        imageName.value = file.name
        paperSizeId.value = sizeId
        mapScaleDenominator.value = DEFAULT_MAP_SCALE_DENOMINATOR
        lines.value = []
        draftPoints.value = []
        selectedLineId.value = null
        recalculateAllLines()
      })
  }

  /** @deprecated 使用 loadMap */
  function loadImage(file: File, sizeId: PaperSizeId) {
    return loadMap(file, sizeId)
  }

  function addDraftPoint(point: Point) {
    draftPoints.value = [...draftPoints.value, point]
  }

  function undoDraftPoint() {
    if (draftPoints.value.length === 0) return
    draftPoints.value = draftPoints.value.slice(0, -1)
  }

  function clearDraft() {
    draftPoints.value = []
  }

  function finishDraft() {
    if (draftPoints.value.length < 2) {
      draftPoints.value = []
      return null
    }
    const line = createLine(draftPoints.value, nextLineColor(lines.value.length), metersPerPixel.value)
    lines.value = [...lines.value, line]
    draftPoints.value = []
    selectedLineId.value = line.id
    return line
  }

  function removeLine(id: string) {
    lines.value = lines.value.filter((l) => l.id !== id)
    if (selectedLineId.value === id) selectedLineId.value = null
  }

  function toggleLineVisibility(id: string) {
    lines.value = lines.value.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
  }

  function selectLine(id: string | null) {
    selectedLineId.value = id
  }

  function setLineColor(id: string, color: string) {
    const normalized = normalizeColorHex(color) ?? color
    lines.value = lines.value.map((l) => (l.id === id ? { ...l, color: normalized } : l))
  }

  function addCustomColor(color: string) {
    const normalized = normalizeColorHex(color)
    if (!normalized) return
    const palette = mergePaletteColors(PRESET_LINE_COLORS, customColors.value)
    if (palette.includes(normalized)) return
    customColors.value = [...customColors.value, normalized]
  }

  function updateLinePoint(lineId: string, pointIndex: number, point: Point) {
    const mpp = metersPerPixel.value
    lines.value = lines.value.map((line) => {
      if (line.id !== lineId) return line
      const points = line.points.map((p, i) => (i === pointIndex ? { ...point } : p))
      const pixelLength = polylinePixelLength(points)
      return {
        ...line,
        points,
        pixelLength,
        realLengthMeters: mpp !== null ? pixelToRealLength(pixelLength, mpp) : null,
      }
    })
  }

  function updateLineLabelPosition(lineId: string, position: Point) {
    lines.value = lines.value.map((line) =>
      line.id === lineId ? { ...line, labelPosition: { ...position } } : line,
    )
  }

  function updateLineLabelFontSize(lineId: string, fontSize: number) {
    const size = Math.min(MAX_LABEL_FONT_SIZE, Math.max(MIN_LABEL_FONT_SIZE, Math.round(fontSize)))
    lines.value = lines.value.map((line) =>
      line.id === lineId ? { ...line, labelFontSize: size } : line,
    )
  }

  function updateLineStrokeWidth(lineId: string, width: number) {
    const strokeWidth = Math.min(MAX_LINE_STROKE_WIDTH, Math.max(MIN_LINE_STROKE_WIDTH, Math.round(width)))
    lines.value = lines.value.map((line) =>
      line.id === lineId ? { ...line, strokeWidth } : line,
    )
  }

  function setActiveTool(tool: ToolMode) {
    if (exportSelecting.value && tool !== 'exportRegion') {
      cancelExportSelection()
    }
    activeTool.value = tool
    if (tool === 'pan') clearDraft()
  }

  function startExportRegionSelection() {
    exportSelecting.value = true
    activeTool.value = 'exportRegion'
    selectedLineId.value = null
    clearDraft()
  }

  function cancelExportSelection() {
    exportSelecting.value = false
    if (activeTool.value === 'exportRegion') {
      activeTool.value = 'select'
    }
  }

  return {
    image,
    imageName,
    paperSizeId,
    mapScaleDenominator,
    metersPerPixel,
    scale,
    lines,
    activeTool,
    selectedLineId,
    draftPoints,
    customColors,
    paletteColors,
    totalRealLength,
    exportSelecting,
    setPaperSizeId,
    setMapScaleDenominator,
    loadMap,
    loadImage,
    addDraftPoint,
    undoDraftPoint,
    clearDraft,
    finishDraft,
    removeLine,
    toggleLineVisibility,
    selectLine,
    setLineColor,
    addCustomColor,
    updateLinePoint,
    updateLineLabelPosition,
    updateLineLabelFontSize,
    updateLineStrokeWidth,
    startExportRegionSelection,
    cancelExportSelection,
    setActiveTool,
  }
})
