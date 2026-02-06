/**
 * Generate color palettes for dithering
 */

export const PRESET_PALETTES = {
  monochrome: [[0, 0, 0], [255, 255, 255]],

  cga: [
    [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170],
    [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
    [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
    [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255]
  ],

  gameboy: [
    [15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]
  ],

  // 8-color palette
  basic8: [
    [0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255],
    [255, 255, 0], [255, 0, 255], [0, 255, 255], [255, 255, 255]
  ],

  // Custom grayscale levels
  grayscale4: [[0, 0, 0], [85, 85, 85], [170, 170, 170], [255, 255, 255]],

  grayscale8: Array.from({ length: 8 }, (_, i) => {
    const val = Math.floor(i * 255 / 7)
    return [val, val, val]
  }),

  grayscale16: Array.from({ length: 16 }, (_, i) => {
    const val = Math.floor(i * 255 / 15)
    return [val, val, val]
  }),
}

/**
 * Generate custom palette from color count
 */
export function generatePalette(colorCount: number): number[][] {
  if (colorCount <= 2) {
    return PRESET_PALETTES.monochrome
  }

  // Generate evenly distributed RGB palette
  const colorsPerChannel = Math.ceil(Math.pow(colorCount, 1/3))
  const palette: number[][] = []

  for (let r = 0; r < colorsPerChannel; r++) {
    for (let g = 0; g < colorsPerChannel; g++) {
      for (let b = 0; b < colorsPerChannel; b++) {
        if (palette.length >= colorCount) break

        palette.push([
          Math.floor(r * 255 / (colorsPerChannel - 1)),
          Math.floor(g * 255 / (colorsPerChannel - 1)),
          Math.floor(b * 255 / (colorsPerChannel - 1))
        ])
      }
      if (palette.length >= colorCount) break
    }
    if (palette.length >= colorCount) break
  }

  return palette.slice(0, colorCount)
}
