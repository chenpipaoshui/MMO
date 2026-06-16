import { imageToScreen } from './viewport'
import type { Viewport } from './viewport'
import type { Point } from '../types'

export interface PointHit {
  lineId: string
  pointIndex: number
  screenDistance: number
}

const BASE_POINT_HIT_RADIUS = 8
const BASE_LINE_HIT_RADIUS = 4

function scaledPointHitRadius(viewport: Viewport): number {
  return Math.max(12, BASE_POINT_HIT_RADIUS * viewport.zoom + 6)
}

function scaledLineHitRadius(viewport: Viewport): number {
  return Math.max(6, BASE_LINE_HIT_RADIUS * viewport.zoom + 2)
}

export function findNearestPointHit(
  screenPoint: Point,
  lines: { id: string; points: Point[]; visible: boolean }[],
  viewport: Viewport,
  preferredLineId: string | null = null,
  hitRadius = scaledPointHitRadius(viewport),
): PointHit | null {
  const candidates: PointHit[] = []

  for (const line of lines) {
    if (!line.visible) continue
    line.points.forEach((pt, index) => {
      const screen = imageToScreen(pt, viewport)
      const dx = screen.x - screenPoint.x
      const dy = screen.y - screenPoint.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= hitRadius) {
        candidates.push({ lineId: line.id, pointIndex: index, screenDistance: dist })
      }
    })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (preferredLineId) {
      const aPreferred = a.lineId === preferredLineId ? 0 : 1
      const bPreferred = b.lineId === preferredLineId ? 0 : 1
      if (aPreferred !== bPreferred) return aPreferred - bPreferred
    }
    return a.screenDistance - b.screenDistance
  })

  return candidates[0]
}

export function findLineHit(
  screenPoint: Point,
  lines: { id: string; points: Point[]; visible: boolean }[],
  viewport: Viewport,
  hitRadius = scaledLineHitRadius(viewport),
): string | null {
  let bestId: string | null = null
  let bestDist = Infinity

  for (const line of lines) {
    if (!line.visible || line.points.length < 2) continue
    for (let i = 1; i < line.points.length; i++) {
      const a = imageToScreen(line.points[i - 1], viewport)
      const b = imageToScreen(line.points[i], viewport)
      const dist = pointToSegmentDistance(screenPoint, a, b)
      if (dist < hitRadius && dist < bestDist) {
        bestDist = dist
        bestId = line.id
      }
    }
  }

  return bestId
}

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const ex = p.x - a.x
    const ey = p.y - a.y
    return Math.sqrt(ex * ex + ey * ey)
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  const ex = p.x - projX
  const ey = p.y - projY
  return Math.sqrt(ex * ex + ey * ey)
}

export function clampPointToImage(point: Point, imageWidth: number, imageHeight: number): Point {
  return {
    x: Math.min(imageWidth, Math.max(0, point.x)),
    y: Math.min(imageHeight, Math.max(0, point.y)),
  }
}
