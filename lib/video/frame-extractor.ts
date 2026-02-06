import type { VideoMetadata } from '@/types/processing.types'

/**
 * Streaming frame extraction using video element (memory-efficient for 4K)
 */
export class VideoFrameExtractor {
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private metadata: VideoMetadata

  constructor(videoFile: File, metadata: VideoMetadata) {
    this.video = document.createElement('video')
    this.video.src = URL.createObjectURL(videoFile)
    this.video.muted = true
    this.video.crossOrigin = 'anonymous'

    this.canvas = document.createElement('canvas')
    this.canvas.width = metadata.width
    this.canvas.height = metadata.height
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!

    this.metadata = metadata
  }

  /**
   * Extract frame at specific timestamp with robust polling
   */
  async extractFrame(frameNumber: number): Promise<ImageData> {
    const targetTime = frameNumber / this.metadata.fps
    this.video.currentTime = targetTime

    // Robust seek with timeout and polling (avoids onseeked race conditions)
    const TIMEOUT_MS = 5000
    const POLL_INTERVAL_MS = 50
    const TOLERANCE = 0.1 // 100ms tolerance for keyframe snapping

    const startTime = Date.now()

    while (true) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        throw new Error(`Frame extraction timeout at frame ${frameNumber} (target: ${targetTime.toFixed(2)}s)`)
      }

      // Check if seek completed (within tolerance)
      const currentTime = this.video.currentTime
      if (Math.abs(currentTime - targetTime) < TOLERANCE) {
        // Wait one more frame to ensure decode completes
        await new Promise(resolve => setTimeout(resolve, 16))
        break
      }

      // Poll again
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    // Draw frame to canvas
    this.ctx.drawImage(this.video, 0, 0)

    // Extract ImageData
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * Process frames with callback
   */
  async processFrames(
    startFrame: number,
    endFrame: number,
    onFrame: (imageData: ImageData, frameNumber: number) => Promise<void>,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    for (let i = startFrame; i <= endFrame; i++) {
      const imageData = await this.extractFrame(i)
      await onFrame(imageData, i)

      if (onProgress) {
        onProgress(i - startFrame + 1, endFrame - startFrame + 1)
      }
    }
  }

  dispose(): void {
    URL.revokeObjectURL(this.video.src)
  }
}

/**
 * Get video metadata from file
 */
export async function getVideoMetadata(videoFile: File): Promise<VideoMetadata> {
  const video = document.createElement('video')
  video.src = URL.createObjectURL(videoFile)

  await new Promise((resolve) => {
    video.onloadedmetadata = resolve
  })

  // Use default 30fps (accurate FPS would require FFmpeg probe)
  // Common video framerates: 24, 25, 30, 60
  const fps = 30
  console.warn('Using default 30fps - for accurate FPS, video should specify in metadata')

  const metadata: VideoMetadata = {
    width: video.videoWidth,
    height: video.videoHeight,
    fps: fps,
    duration: video.duration,
    totalFrames: Math.floor(video.duration * fps),
  }

  URL.revokeObjectURL(video.src)

  return metadata
}
