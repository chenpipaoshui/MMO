const PREVIEW_BUCKETS = [256, 512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384]

const cacheByImage = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement>>()

function bucketSize(targetWidth: number): number {
  for (const size of PREVIEW_BUCKETS) {
    if (targetWidth <= size) return size
  }
  return targetWidth
}

function buildPreview(image: HTMLImageElement, width: number): HTMLCanvasElement {
  const height = Math.max(1, Math.round((image.height * width) / image.width))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, width, height)
  return canvas
}

/** 缩小时返回预降采样画布，避免大图直接 drawImage 产生锯齿 */
export function resolveMapDrawSource(
  image: HTMLImageElement,
  zoom: number,
  dpr: number,
): CanvasImageSource {
  const screenWidth = image.width * zoom
  const targetPx = Math.ceil(screenWidth * dpr * 2)

  if (targetPx >= image.width) return image

  const bucket = bucketSize(targetPx)
  let imageCache = cacheByImage.get(image)
  if (!imageCache) {
    imageCache = new Map()
    cacheByImage.set(image, imageCache)
  }

  let preview = imageCache.get(bucket)
  if (!preview) {
    preview = buildPreview(image, bucket)
    imageCache.set(bucket, preview)
  }

  return preview
}
