import type { Point } from '../types'

export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function polylinePixelLength(points: Point[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i])
  }
  return total
}

export function pixelToRealLength(pixelLength: number, metersPerPixel: number): number {
  return pixelLength * metersPerPixel
}

export function formatLength(meters: number | null, unit: 'm' | 'km'): string {
  if (meters === null) return '—'
  if (unit === 'km') {
    return meters >= 1000 ? `${(meters / 1000).toFixed(3)} km` : `${meters.toFixed(2)} m`
  }
  return `${meters.toFixed(2)} m`
}

export function formatLineLabelText(pixelLength: number, realLengthMeters: number | null): string {
  if (realLengthMeters !== null) return `${Math.round(realLengthMeters)} m`
  return `${Math.round(pixelLength)} px`
}

/** 折线几何中点（沿路径一半长度处） */
export function polylineMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0] }

  let totalLen = 0
  const segments: { a: Point; b: Point; len: number }[] = []
  for (let i = 1; i < points.length; i++) {
    const len = distance(points[i - 1], points[i])
    segments.push({ a: points[i - 1], b: points[i], len })
    totalLen += len
  }

  if (totalLen === 0) return { ...points[0] }

  const half = totalLen / 2
  let acc = 0
  for (const seg of segments) {
    if (acc + seg.len >= half) {
      const t = seg.len === 0 ? 0 : (half - acc) / seg.len
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
      }
    }
    acc += seg.len
  }
  return { ...points[points.length - 1] }
}

export function defaultLabelPosition(points: Point[]): Point {
  const mid = polylineMidpoint(points)
  return { x: mid.x + 10, y: mid.y - 20 }
}
