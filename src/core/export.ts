import { formatLineLabelText } from './geometry'
import { imageToScreen, type Viewport } from './viewport'
import type { ImageRegion, MeasureLine, Point } from '../types'

const JPEG_QUALITY = 0.92

export function normalizeImageRegion(
  a: Point,
  b: Point,
  imageWidth: number,
  imageHeight: number,
  minSize = 20,
): ImageRegion | null {
  const region = draftImageRegion(a, b, imageWidth, imageHeight)
  if (region.width < minSize || region.height < minSize) return null
  return region
}

export function draftImageRegion(
  a: Point,
  b: Point,
  imageWidth: number,
  imageHeight: number,
): ImageRegion {
  let x = Math.min(a.x, b.x)
  let y = Math.min(a.y, b.y)
  let width = Math.abs(b.x - a.x)
  let height = Math.abs(b.y - a.y)

  x = Math.max(0, x)
  y = Math.max(0, y)
  width = Math.min(width, imageWidth - x)
  height = Math.min(height, imageHeight - y)

  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.floor(width),
    height: Math.floor(height),
  }
}

export type ExportRegionCorner = 'nw' | 'ne' | 'sw' | 'se'

export function getExportRegionCorners(region: ImageRegion): Record<ExportRegionCorner, Point> {
  return {
    nw: { x: region.x, y: region.y },
    ne: { x: region.x + region.width, y: region.y },
    sw: { x: region.x, y: region.y + region.height },
    se: { x: region.x + region.width, y: region.y + region.height },
  }
}

export function hitExportRegionCorner(
  screenPoint: Point,
  region: ImageRegion,
  viewport: Viewport,
  hitRadius = 10,
): ExportRegionCorner | null {
  const corners = getExportRegionCorners(region)
  let best: ExportRegionCorner | null = null
  let bestDist = Infinity

  for (const [key, pt] of Object.entries(corners) as [ExportRegionCorner, Point][]) {
    const screen = imageToScreen(pt, viewport)
    const dx = screen.x - screenPoint.x
    const dy = screen.y - screenPoint.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= hitRadius && dist < bestDist) {
      bestDist = dist
      best = key
    }
  }

  return best
}

export function resizeExportRegionByCorner(
  region: ImageRegion,
  corner: ExportRegionCorner,
  point: Point,
  imageWidth: number,
  imageHeight: number,
  minSize = 20,
): ImageRegion {
  const left = region.x
  const top = region.y
  const right = region.x + region.width
  const bottom = region.y + region.height

  let x1 = left
  let y1 = top
  let x2 = right
  let y2 = bottom

  switch (corner) {
    case 'nw':
      x1 = point.x
      y1 = point.y
      break
    case 'ne':
      x2 = point.x
      y1 = point.y
      break
    case 'sw':
      x1 = point.x
      y2 = point.y
      break
    case 'se':
      x2 = point.x
      y2 = point.y
      break
  }

  let x = Math.min(x1, x2)
  let y = Math.min(y1, y2)
  let width = Math.abs(x2 - x1)
  let height = Math.abs(y2 - y1)

  x = Math.max(0, Math.min(x, imageWidth - minSize))
  y = Math.max(0, Math.min(y, imageHeight - minSize))
  width = Math.min(Math.max(width, minSize), imageWidth - x)
  height = Math.min(Math.max(height, minSize), imageHeight - y)

  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.floor(width),
    height: Math.floor(height),
  }
}

function drawLinesOnContext(ctx: CanvasRenderingContext2D, lines: MeasureLine[]) {
  for (const line of lines) {
    if (!line.visible || line.points.length < 2) continue

    ctx.save()
    ctx.strokeStyle = line.color
    ctx.fillStyle = line.color
    ctx.lineWidth = line.strokeWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(line.points[0].x, line.points[0].y)
    for (let i = 1; i < line.points.length; i++) {
      ctx.lineTo(line.points[i].x, line.points[i].y)
    }
    ctx.stroke()
    ctx.restore()
  }
}

function drawLabelsOnContext(ctx: CanvasRenderingContext2D, lines: MeasureLine[]) {
  for (const line of lines) {
    if (!line.visible) continue

    const text = formatLineLabelText(line.pixelLength, line.realLengthMeters)
    ctx.save()
    ctx.font = `600 ${line.labelFontSize}px system-ui, sans-serif`
    ctx.fillStyle = line.color
    ctx.textBaseline = 'top'
    ctx.fillText(text, line.labelPosition.x, line.labelPosition.y)
    ctx.restore()
  }
}

export function buildExportCanvas(
  image: HTMLImageElement,
  lines: MeasureLine[],
  region?: ImageRegion,
): HTMLCanvasElement {
  const fullWidth = image.width
  const fullHeight = image.height
  const crop = region ?? { x: 0, y: 0, width: fullWidth, height: fullHeight }

  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建导出画布')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, crop.width, crop.height)

  ctx.save()
  ctx.translate(-crop.x, -crop.y)
  ctx.drawImage(image, 0, 0)
  drawLinesOnContext(ctx, lines)
  drawLabelsOnContext(ctx, lines)
  ctx.restore()

  return canvas
}

export function downloadCanvasAsJpeg(
  canvas: HTMLCanvasElement,
  filename: string,
  quality = JPEG_QUALITY,
): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('导出失败'))
          return
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`
        link.click()
        URL.revokeObjectURL(url)
        resolve()
      },
      'image/jpeg',
      quality,
    )
  })
}

export function makeExportFilename(imageName: string, suffix = 'export'): string {
  const base = imageName.replace(/\.[^.]+$/, '') || 'map'
  return `${base}_${suffix}.jpg`
}

export async function exportMapAsJpeg(
  image: HTMLImageElement,
  lines: MeasureLine[],
  imageName: string,
  region?: ImageRegion,
): Promise<void> {
  const canvas = buildExportCanvas(image, lines, region)
  const suffix = region ? 'crop' : 'full'
  await downloadCanvasAsJpeg(canvas, makeExportFilename(imageName, suffix))
}
