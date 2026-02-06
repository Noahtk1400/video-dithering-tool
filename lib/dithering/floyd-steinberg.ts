import type { DitheringConfig } from '@/types/processing.types'
import { BloomShader } from '@/lib/effects/bloom-shader'

/**
 * True Floyd-Steinberg error diffusion algorithm
 *
 * Error distribution pattern:
 *         X   7/16
 *   3/16  5/16  1/16
 *
 * Where X is the current pixel
 */

export class FloydSteinbergDithering {
  private errorBuffer: Float32Array[] = []
  private config: DitheringConfig

  constructor(config: DitheringConfig) {
    this.config = config
    // Pre-allocate error buffer for entire image (3 rows needed for diffusion)
    this.initializeErrorBuffer(config.width, config.height)
  }

  /**
   * Apply Floyd-Steinberg dithering to ImageData
   */
  public dither(imageData: ImageData): ImageData {
    const { data, width, height } = imageData
    const output = new Uint8ClampedArray(data)

    // Apply pre-processing adjustments
    this.applyAdjustments(output, width, height)

    // Apply pixelation if configured
    if (this.config.pixelation > 1) {
      this.applyPixelation(output, width, height)
    }

    // Main Floyd-Steinberg loop
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4

        // Get original pixel + accumulated error
        const r = Math.max(0, Math.min(255, output[idx] + this.errorBuffer[y][x * 3]))
        const g = Math.max(0, Math.min(255, output[idx + 1] + this.errorBuffer[y][x * 3 + 1]))
        const b = Math.max(0, Math.min(255, output[idx + 2] + this.errorBuffer[y][x * 3 + 2]))

        // Find closest palette color
        const closest = this.findClosestColor(r, g, b)

        // Calculate quantization error
        const errR = r - closest[0]
        const errG = g - closest[1]
        const errB = b - closest[2]

        // Set output pixel
        output[idx] = closest[0]
        output[idx + 1] = closest[1]
        output[idx + 2] = closest[2]
        output[idx + 3] = 255 // Alpha

        // Distribute error to neighboring pixels
        this.distributeError(x, y, width, height, errR, errG, errB)
      }

      // Clear processed row from error buffer (memory optimization)
      if (y > 0) {
        this.errorBuffer[y - 1] = new Float32Array(0)
      }
    }

    const ditheredData = new ImageData(output, width, height)

    // Apply bloom if configured
    if (this.config.bloom) {
      return this.applyBloomEffect(ditheredData)
    }

    return ditheredData
  }

  /**
   * Distribute quantization error to neighboring pixels
   */
  private distributeError(
    x: number, y: number,
    width: number, height: number,
    errR: number, errG: number, errB: number
  ): void {
    const distribute = (dx: number, dy: number, weight: number) => {
      const nx = x + dx
      const ny = y + dy

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = nx * 3
        this.errorBuffer[ny][idx] += errR * weight
        this.errorBuffer[ny][idx + 1] += errG * weight
        this.errorBuffer[ny][idx + 2] += errB * weight
      }
    }

    // Floyd-Steinberg error diffusion matrix
    distribute(1, 0, 7/16)   // Right
    distribute(-1, 1, 3/16)  // Bottom-left
    distribute(0, 1, 5/16)   // Bottom
    distribute(1, 1, 1/16)   // Bottom-right
  }

  /**
   * Find closest color in palette using Euclidean distance
   */
  private findClosestColor(r: number, g: number, b: number): number[] {
    let minDistance = Infinity
    let closest = this.config.palette[0]

    for (const color of this.config.palette) {
      const distance = Math.sqrt(
        Math.pow(r - color[0], 2) +
        Math.pow(g - color[1], 2) +
        Math.pow(b - color[2], 2)
      )

      if (distance < minDistance) {
        minDistance = distance
        closest = color
      }
    }

    return closest
  }

  /**
   * Apply brightness, contrast, and threshold adjustments
   */
  private applyAdjustments(data: Uint8ClampedArray, width: number, height: number): void {
    const factor = (259 * (this.config.contrast + 255)) / (255 * (259 - this.config.contrast))

    for (let i = 0; i < data.length; i += 4) {
      // Brightness
      let r = data[i] + this.config.brightness
      let g = data[i + 1] + this.config.brightness
      let b = data[i + 2] + this.config.brightness

      // Contrast
      r = factor * (r - 128) + 128
      g = factor * (g - 128) + 128
      b = factor * (b - 128) + 128

      // Threshold
      if (this.config.threshold > 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b
        if (gray < this.config.threshold) {
          r = g = b = 0
        }
      }

      data[i] = Math.max(0, Math.min(255, r))
      data[i + 1] = Math.max(0, Math.min(255, g))
      data[i + 2] = Math.max(0, Math.min(255, b))
    }
  }

  /**
   * Apply pixelation effect by averaging blocks
   */
  private applyPixelation(data: Uint8ClampedArray, width: number, height: number): void {
    const blockSize = this.config.pixelation

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Calculate average color for block
        let avgR = 0, avgG = 0, avgB = 0, count = 0

        for (let by = 0; by < blockSize && y + by < height; by++) {
          for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4
            avgR += data[idx]
            avgG += data[idx + 1]
            avgB += data[idx + 2]
            count++
          }
        }

        avgR /= count
        avgG /= count
        avgB /= count

        // Apply average to all pixels in block
        for (let by = 0; by < blockSize && y + by < height; by++) {
          for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4
            data[idx] = avgR
            data[idx + 1] = avgG
            data[idx + 2] = avgB
          }
        }
      }
    }
  }

  /**
   * Initialize error buffer with memory optimization
   */
  private initializeErrorBuffer(width: number, height: number): void {
    this.errorBuffer = new Array(height)
    for (let i = 0; i < height; i++) {
      this.errorBuffer[i] = new Float32Array(width * 3) // RGB channels
    }
  }

  /**
   * Apply bloom effect to dithered image
   */
  private applyBloomEffect(imageData: ImageData): ImageData {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height

    const bloomShader = new BloomShader(canvas)
    const result = bloomShader.applyBloom(imageData, this.config.bloom!)
    bloomShader.dispose()

    return result
  }

  /**
   * Release memory
   */
  public dispose(): void {
    this.errorBuffer = []
  }
}
