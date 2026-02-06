import { FloydSteinbergDithering } from '../dithering/floyd-steinberg'
import type { WorkerMessage, WorkerResponse } from '@/types/worker.types'

// Worker receives messages with ImageData and processing config
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { frameNumber, imageData, config } = e.data

  try {
    // Create dithering processor
    const dithering = new FloydSteinbergDithering({
      palette: config.palette,
      width: imageData.width,
      height: imageData.height,
      pixelation: config.pixelation,
      brightness: config.brightness,
      contrast: config.contrast,
      threshold: config.threshold,
    })

    // Process frame
    const processedImageData = dithering.dither(imageData)

    // Clean up
    dithering.dispose()

    // Send result back to main thread
    const response: WorkerResponse = {
      success: true,
      frameNumber,
      imageData: processedImageData,
    }

    // Transfer ownership back to main thread
    self.postMessage(response, { transfer: [processedImageData.data.buffer] })

  } catch (error) {
    const response: WorkerResponse = {
      success: false,
      frameNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    }

    self.postMessage(response)
  }
}

export {}
