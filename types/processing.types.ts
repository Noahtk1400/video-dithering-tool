import type { BloomConfig } from '@/lib/effects/bloom-shader'

export interface ProcessingParameters {
  palettePreset: string
  pixelation: number
  brightness: number
  contrast: number
  threshold: number
  bloom?: BloomConfig  // Optional bloom effect
}

export interface VideoMetadata {
  width: number
  height: number
  fps: number
  duration: number
  totalFrames: number
}

export interface DitheringConfig {
  palette: number[][]        // RGB color palette [[r,g,b], [r,g,b], ...]
  width: number
  height: number
  pixelation: number         // 1 = no pixelation, 2+ = pixel block size
  brightness: number         // -100 to 100
  contrast: number           // -100 to 100
  threshold: number          // 0 to 255
  bloom?: BloomConfig        // Optional bloom effect
}
