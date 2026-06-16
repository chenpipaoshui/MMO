export const PRESET_LINE_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#64748b',
  '#0f172a',
]

/** @deprecated 使用 PRESET_LINE_COLORS 或 store.paletteColors */
export const LINE_COLORS = PRESET_LINE_COLORS

export function normalizeColorHex(color: string): string | null {
  const raw = color.trim()
  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null
  return normalized.toLowerCase()
}

export function nextLineColor(index: number): string {
  return PRESET_LINE_COLORS[index % PRESET_LINE_COLORS.length]
}

export function mergePaletteColors(preset: string[], custom: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const color of [...preset, ...custom]) {
    const normalized = normalizeColorHex(color)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

export function isPresetColor(color: string): boolean {
  const normalized = normalizeColorHex(color)
  if (!normalized) return false
  return PRESET_LINE_COLORS.some((c) => normalizeColorHex(c) === normalized)
}
