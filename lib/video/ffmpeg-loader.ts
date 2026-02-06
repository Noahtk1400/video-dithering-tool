import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null

export async function loadFFmpeg(
  onProgress?: (progress: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance
  }

  const ffmpeg = new FFmpeg()

  // Load FFmpeg core files from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  // Set up progress logging
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(progress * 100)
    })
  }

  ffmpegInstance = ffmpeg
  return ffmpeg
}

export function getFFmpegInstance(): FFmpeg | null {
  return ffmpegInstance
}
