export interface ImagePyramid {
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly levelCount: number
  getLevelForZoom(zoom: number): number
  getLevelCanvas(level: number): HTMLCanvasElement | null
  dispose(): void
}

function downsample(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): HTMLCanvasElement {
  const width = Math.max(1, Math.floor(sourceWidth / 2))
  const height = Math.max(1, Math.floor(sourceHeight / 2))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建降采样画布')
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height)
  return canvas
}

function buildLevels(
  source: CanvasImageSource,
  width: number,
  height: number,
  onLevel?: (levelIndex: number) => void,
): HTMLCanvasElement[] {
  const levels: HTMLCanvasElement[] = []
  let prev = source
  let prevW = width
  let prevH = height

  while (Math.min(prevW, prevH) > 1) {
    const canvas = downsample(prev, prevW, prevH)
    levels.push(canvas)
    onLevel?.(levels.length)
    prev = canvas
    prevW = canvas.width
    prevH = canvas.height
  }

  return levels
}

class ImagePyramidImpl implements ImagePyramid {
  readonly sourceWidth: number
  readonly sourceHeight: number
  private readonly levels: HTMLCanvasElement[]

  constructor(sourceWidth: number, sourceHeight: number, levels: HTMLCanvasElement[]) {
    this.sourceWidth = sourceWidth
    this.sourceHeight = sourceHeight
    this.levels = levels
  }

  get levelCount(): number {
    return this.levels.length + 1
  }

  /** 0 = 原图；越大表示预降采样越激进 */
  getLevelForZoom(zoom: number): number {
    if (zoom >= 1 || this.levels.length === 0) return 0
    const level = Math.floor(-Math.log2(zoom))
    return Math.min(Math.max(0, level), this.levels.length)
  }

  getLevelCanvas(level: number): HTMLCanvasElement | null {
    if (level <= 0) return null
    return this.levels[level - 1] ?? null
  }

  dispose(): void {
    this.levels.length = 0
  }
}

export function buildImagePyramid(
  source: CanvasImageSource,
  width: number,
  height: number,
): ImagePyramid {
  const levels = buildLevels(source, width, height)
  return new ImagePyramidImpl(width, height, levels)
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export interface ImagePyramidBuildSignal {
  readonly cancelled: boolean
}

/** 分帧构建，避免大图导入时阻塞主线程 */
export async function buildImagePyramidAsync(
  source: CanvasImageSource,
  width: number,
  height: number,
  signal?: ImagePyramidBuildSignal,
): Promise<ImagePyramid> {
  const levels: HTMLCanvasElement[] = []
  let prev = source
  let prevW = width
  let prevH = height

  while (Math.min(prevW, prevH) > 1) {
    if (signal?.cancelled) {
      levels.length = 0
      throw new Error('cancelled')
    }
    await nextFrame()
    const canvas = downsample(prev, prevW, prevH)
    levels.push(canvas)
    prev = canvas
    prevW = canvas.width
    prevH = canvas.height
  }

  return new ImagePyramidImpl(width, height, levels)
}

export function drawPyramidLevel(
  ctx: CanvasRenderingContext2D,
  pyramid: ImagePyramid,
  source: CanvasImageSource,
  level: number,
): void {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (level <= 0) {
    ctx.drawImage(source, 0, 0, pyramid.sourceWidth, pyramid.sourceHeight)
    return
  }

  const cached = pyramid.getLevelCanvas(level)
  if (!cached) {
    ctx.drawImage(source, 0, 0, pyramid.sourceWidth, pyramid.sourceHeight)
    return
  }

  ctx.drawImage(
    cached,
    0,
    0,
    cached.width,
    cached.height,
    0,
    0,
    pyramid.sourceWidth,
    pyramid.sourceHeight,
  )
}
