import type { FFmpeg } from '@ffmpeg/ffmpeg'

export interface EncodingOptions {
  fps: number
  width: number
  height: number
  quality: number      // CRF value (18-28, lower = better quality)
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow'
}

/**
 * Encode processed frames back to MP4
 */
export class FrameEncoder {
  private ffmpeg: FFmpeg
  private frameCount: number = 0

  constructor(ffmpeg: FFmpeg) {
    this.ffmpeg = ffmpeg
  }

  /**
   * Add processed frame to encoding queue
   */
  async addFrame(imageData: ImageData, frameNumber: number): Promise<void> {
    // Convert ImageData to PNG blob
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })

    // Write frame to FFmpeg virtual filesystem
    const filename = `processed_${String(frameNumber).padStart(6, '0')}.png`
    await this.ffmpeg.writeFile(filename, new Uint8Array(await blob.arrayBuffer()))

    this.frameCount++
  }

  /**
   * Encode all frames to MP4
   */
  async encode(
    options: EncodingOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    // Set up progress monitoring
    if (onProgress) {
      this.ffmpeg.on('progress', ({ progress }) => {
        onProgress(progress * 100)
      })
    }

    // Encode frames to MP4 using H.264
    await this.ffmpeg.exec([
      '-framerate', options.fps.toString(),
      '-i', 'processed_%06d.png',
      '-c:v', 'libx264',
      '-preset', options.preset,
      '-crf', options.quality.toString(),
      '-pix_fmt', 'yuv420p',      // Compatibility with After Effects
      '-movflags', '+faststart',   // Web optimization
      'output.mp4'
    ])

    // Read output file
    const data = await this.ffmpeg.readFile('output.mp4')
    const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer)

    // Copy to regular ArrayBuffer to avoid SharedArrayBuffer issues
    const buffer = new ArrayBuffer(uint8Array.length)
    const view = new Uint8Array(buffer)
    view.set(uint8Array)

    // Clean up frame files
    for (let i = 0; i < this.frameCount; i++) {
      const filename = `processed_${String(i).padStart(6, '0')}.png`
      try {
        await this.ffmpeg.deleteFile(filename)
      } catch (e) {
        // Ignore errors for missing files
      }
    }

    // Clean up output file
    await this.ffmpeg.deleteFile('output.mp4')

    return new Blob([buffer], { type: 'video/mp4' })
  }

  /**
   * Encode with original audio track
   */
  async encodeWithAudio(
    options: EncodingOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    // Assume input.mp4 still exists in virtual filesystem
    await this.ffmpeg.exec([
      '-framerate', options.fps.toString(),
      '-i', 'processed_%06d.png',
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-preset', options.preset,
      '-crf', options.quality.toString(),
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',              // Copy audio stream without re-encoding
      '-map', '0:v:0',             // Video from processed frames
      '-map', '1:a:0?',            // Audio from original (? makes it optional)
      '-shortest',                 // Match shortest stream duration
      'output.mp4'
    ])

    const data = await this.ffmpeg.readFile('output.mp4')
    const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer)

    // Copy to regular ArrayBuffer to avoid SharedArrayBuffer issues
    const buffer = new ArrayBuffer(uint8Array.length)
    const view = new Uint8Array(buffer)
    view.set(uint8Array)

    await this.ffmpeg.deleteFile('output.mp4')

    return new Blob([buffer], { type: 'video/mp4' })
  }
}
