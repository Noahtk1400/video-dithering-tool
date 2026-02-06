import type { BloomConfig } from '@/lib/effects/bloom-shader'

export interface WorkerMessage {
  frameNumber: number
  imageData: ImageData
  config: {
    palette: number[][]
    pixelation: number
    brightness: number
    contrast: number
    threshold: number
    bloom?: BloomConfig  // Optional bloom effect
  }
}

export interface WorkerResponse {
  success: boolean
  frameNumber: number
  imageData?: ImageData
  error?: string
}
