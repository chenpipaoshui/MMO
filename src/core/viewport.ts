import type { Point } from '../types'

export interface Viewport {
  zoom: number
  offsetX: number
  offsetY: number
}

export function createViewport(): Viewport {
  return { zoom: 1, offsetX: 0, offsetY: 0 }
}

export function screenToImage(screen: Point, viewport: Viewport): Point {
  return {
    x: (screen.x - viewport.offsetX) / viewport.zoom,
    y: (screen.y - viewport.offsetY) / viewport.zoom,
  }
}

export function imageToScreen(image: Point, viewport: Viewport): Point {
  return {
    x: image.x * viewport.zoom + viewport.offsetX,
    y: image.y * viewport.zoom + viewport.offsetY,
  }
}

export function fitImageToCanvas(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding = 40,
): Viewport {
  const availableW = Math.max(canvasWidth - padding * 2, 1)
  const availableH = Math.max(canvasHeight - padding * 2, 1)
  const zoom = Math.min(availableW / imageWidth, availableH / imageHeight)
  const offsetX = (canvasWidth - imageWidth * zoom) / 2
  const offsetY = (canvasHeight - imageHeight * zoom) / 2
  return { zoom, offsetX, offsetY }
}

export function clampZoom(zoom: number, min = 0.05, max = 20): number {
  return Math.min(max, Math.max(min, zoom))
}
