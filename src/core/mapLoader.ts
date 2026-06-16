import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { getPaperSize } from './paper'
import type { PaperSize, PaperSizeId } from '../types'

GlobalWorkerOptions.workerSrc = workerUrl

/** PDF 默认 72 DPI，工程图/地图建议更高渲染分辨率 */
const PDF_DPI = 72
const TARGET_DPI = 300
const MAX_CANVAS_SIDE = 16384

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function computePdfRenderScale(page: PDFPageProxy, paper?: PaperSize): number {
  const baseViewport = page.getViewport({ scale: 1 })

  // 至少按 300 DPI 渲染（PDF 点阵 → 像素）
  let scale = TARGET_DPI / PDF_DPI

  // 结合所选纸张，保证像素密度足够
  if (paper) {
    const targetWidthPx = (paper.widthMm / 25.4) * TARGET_DPI
    const targetHeightPx = (paper.heightMm / 25.4) * TARGET_DPI
    scale = Math.max(
      scale,
      targetWidthPx / baseViewport.width,
      targetHeightPx / baseViewport.height,
    )
  }

  // 不超过浏览器 canvas 单边上限
  const maxSide = Math.max(baseViewport.width, baseViewport.height) * scale
  if (maxSide > MAX_CANVAS_SIDE) {
    scale *= MAX_CANVAS_SIDE / maxSide
  }

  return scale
}

export async function getPdfPageCount(file: File): Promise<number> {
  const data = await file.arrayBuffer()
  const pdf = await getDocument({ data }).promise
  return pdf.numPages
}

export async function renderPdfPageToImage(
  file: File,
  pageNumber = 1,
  paperSizeId?: PaperSizeId,
): Promise<HTMLImageElement> {
  const data = await file.arrayBuffer()
  const pdf = await getDocument({ data }).promise

  if (pdf.numPages < 1) {
    throw new Error('PDF 文件为空')
  }

  const pageIndex = Math.min(Math.max(pageNumber, 1), pdf.numPages)
  const page = await pdf.getPage(pageIndex)
  const paper = paperSizeId ? getPaperSize(paperSizeId) : undefined
  const scale = computePdfRenderScale(page, paper)

  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建画布')
  }

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise

  return canvasToImage(canvas)
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PDF 渲染失败'))
        return
      }
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('PDF 渲染失败'))
      }
      img.src = url
    }, 'image/png')
  })
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export async function loadMapFileAsImage(
  file: File,
  pdfPage = 1,
  paperSizeId?: PaperSizeId,
): Promise<HTMLImageElement> {
  if (isPdfFile(file)) {
    return renderPdfPageToImage(file, pdfPage, paperSizeId)
  }
  return loadImageFile(file)
}
