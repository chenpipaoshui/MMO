import type { PaperSize, PaperSizeId } from '../types'

export const PAPER_SIZES: PaperSize[] = [
  { id: 'A4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'A3', label: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  { id: 'A2', label: 'A2 (420 × 594 mm)', widthMm: 420, heightMm: 594 },
  { id: 'A1', label: 'A1 (594 × 841 mm)', widthMm: 594, heightMm: 841 },
  { id: 'A0', label: 'A0 (841 × 1189 mm)', widthMm: 841, heightMm: 1189 },
]

export function getPaperSize(id: PaperSizeId): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? PAPER_SIZES[0]
}

/** 根据纸张尺寸、地图比例与图片像素尺寸计算每像素对应的实际米数 */
export function computeMetersPerPixelFromMapScale(
  imageWidth: number,
  imageHeight: number,
  paper: PaperSize,
  mapScaleDenominator: number,
): number | null {
  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    !Number.isFinite(mapScaleDenominator) ||
    mapScaleDenominator <= 0
  ) {
    return null
  }

  let paperWidthMm = paper.widthMm
  let paperHeightMm = paper.heightMm

  const imageLandscape = imageWidth >= imageHeight
  const paperLandscape = paperWidthMm >= paperHeightMm
  if (imageLandscape !== paperLandscape) {
    ;[paperWidthMm, paperHeightMm] = [paperHeightMm, paperWidthMm]
  }

  const mmPerPixelX = paperWidthMm / imageWidth
  const mmPerPixelY = paperHeightMm / imageHeight
  const mmPerPixel = (mmPerPixelX + mmPerPixelY) / 2

  // 比例尺 1:n → 纸上 1 mm 对应实地 n mm
  const metersPerMmOnPaper = mapScaleDenominator / 1000
  return mmPerPixel * metersPerMmOnPaper
}
