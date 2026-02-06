'use client'

import { useState, useCallback, useRef } from 'react'
import { loadFFmpeg } from '@/lib/video/ffmpeg-loader'
import { VideoFrameExtractor, getVideoMetadata } from '@/lib/video/frame-extractor'
import { FrameEncoder } from '@/lib/video/frame-encoder'
import { WorkerPool } from '@/lib/workers/worker-pool'
import { PRESET_PALETTES } from '@/lib/dithering/color-quantization'
import type { ProcessingParameters, VideoMetadata } from '@/types/processing.types'

export function useVideoProcessor() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [parameters, setParameters] = useState<ProcessingParameters>({
    palettePreset: 'monochrome',
    pixelation: 1,
    brightness: 0,
    contrast: 0,
    threshold: 0,
  })

  const [processingState, setProcessingState] = useState({
    isProcessing: false,
    isComplete: false,
    currentFrame: 0,
    totalFrames: 0,
    progress: 0,
    estimatedTimeRemaining: 0,
  })

  const [processedVideo, setProcessedVideo] = useState<Blob | null>(null)

  const frameExtractor = useRef<VideoFrameExtractor | null>(null)
  const workerPool = useRef<WorkerPool | null>(null)
  const cancelledRef = useRef(false)

  /**
   * Upload and analyze video
   */
  const uploadVideo = useCallback(async (file: File) => {
    setVideoFile(file)

    // Get metadata
    const metadata = await getVideoMetadata(file)
    setVideoMetadata(metadata)

    // Initialize frame extractor
    frameExtractor.current = new VideoFrameExtractor(file, metadata)

    // Initialize worker pool
    if (!workerPool.current) {
      workerPool.current = new WorkerPool()
    }
  }, [])

  /**
   * Update processing parameters
   */
  const updateParameters = useCallback((params: Partial<ProcessingParameters>) => {
    setParameters(prev => ({ ...prev, ...params }))
  }, [])

  /**
   * Start full video processing with retry logic and stall detection
   */
  const startProcessing = useCallback(async () => {
    if (!frameExtractor.current || !videoMetadata || !workerPool.current) return

    cancelledRef.current = false
    setProcessingState({
      isProcessing: true,
      isComplete: false,
      currentFrame: 0,
      totalFrames: videoMetadata.totalFrames,
      progress: 0,
      estimatedTimeRemaining: 0,
    })

    const startTime = Date.now()
    const palette = PRESET_PALETTES[parameters.palettePreset as keyof typeof PRESET_PALETTES]

    // WATCHDOG: Detect stalls
    let lastProgressUpdate = Date.now()
    const STALL_THRESHOLD_MS = 30000 // 30 seconds without progress = stall

    const watchdog = setInterval(() => {
      if (Date.now() - lastProgressUpdate > STALL_THRESHOLD_MS) {
        console.error('Processing stalled! Canceling...')
        cancelledRef.current = true
        clearInterval(watchdog)
        alert('Video processing stalled. Try a shorter video or lower resolution.')
      }
    }, 5000)

    try {
      // Load FFmpeg
      const ffmpeg = await loadFFmpeg()
      const encoder = new FrameEncoder(ffmpeg)

      // Dynamic batch size based on resolution
      const batchSize = videoMetadata.width * videoMetadata.height > 1920 * 1080
        ? 5  // 4K videos: smaller batches
        : 10 // 1080p and below: normal batches

      let processedCount = 0

      // Process frames in batches with retry logic
      for (let i = 0; i < videoMetadata.totalFrames; i += batchSize) {
        if (cancelledRef.current) break

        const batchEnd = Math.min(i + batchSize, videoMetadata.totalFrames)
        const batchPromises: Promise<void>[] = []

        // Process batch in parallel
        for (let j = i; j < batchEnd; j++) {
          const frameNumber = j

          // RETRY WRAPPER
          const processWithRetry = async (retries = 3): Promise<void> => {
            try {
              // Extract frame
              const imageData = await frameExtractor.current!.extractFrame(frameNumber)

              // Process frame via worker
              const response = await workerPool.current!.processFrame({
                frameNumber,
                imageData,
                config: {
                  palette,
                  pixelation: parameters.pixelation,
                  brightness: parameters.brightness,
                  contrast: parameters.contrast,
                  threshold: parameters.threshold,
                  bloom: parameters.bloom,
                },
              })

              if (response.success && response.imageData) {
                // Add to encoder
                await encoder.addFrame(response.imageData, frameNumber)
                processedCount++

                // Update progress and reset watchdog
                lastProgressUpdate = Date.now()
                const elapsed = Date.now() - startTime
                const framesPerMs = processedCount / elapsed
                const remainingFrames = videoMetadata.totalFrames - processedCount
                const estimatedRemaining = remainingFrames / framesPerMs

                setProcessingState(prev => ({
                  ...prev,
                  currentFrame: processedCount,
                  progress: (processedCount / videoMetadata.totalFrames) * 100,
                  estimatedTimeRemaining: estimatedRemaining,
                }))
              } else {
                throw new Error(response.error || 'Frame processing failed')
              }
            } catch (error) {
              if (retries > 0) {
                console.warn(`Retry frame ${frameNumber}, attempts left: ${retries}`)
                await new Promise(resolve => setTimeout(resolve, 100))
                return processWithRetry(retries - 1)
              }
              throw error
            }
          }

          batchPromises.push(processWithRetry())
        }

        // Wait for batch to complete
        await Promise.all(batchPromises)
      }

      if (!cancelledRef.current) {
        // Reset watchdog before starting encoding phase (prevents false stall alert)
        lastProgressUpdate = Date.now()

        // Encode final video WITH progress callback
        const videoBlob = await encoder.encode({
          fps: videoMetadata.fps,
          width: videoMetadata.width,
          height: videoMetadata.height,
          quality: 18, // High quality for After Effects
          preset: 'medium',
        }, (progress) => {
          // Update watchdog during encoding to prevent false stall detection
          lastProgressUpdate = Date.now()

          // Update UI with encoding progress
          setProcessingState(prev => ({
            ...prev,
            progress: 100, // Frame processing complete, now encoding
            estimatedTimeRemaining: 0,
          }))
        })

        setProcessedVideo(videoBlob)
        setProcessingState(prev => ({
          ...prev,
          isProcessing: false,
          isComplete: true,
        }))
      }
    } catch (error) {
      console.error('Video processing failed:', error)
      alert(`Video processing failed: ${error}`)
      setProcessingState(prev => ({
        ...prev,
        isProcessing: false,
      }))
    } finally {
      clearInterval(watchdog)
    }
  }, [videoMetadata, parameters])

  /**
   * Cancel processing
   */
  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true
    setProcessingState(prev => ({
      ...prev,
      isProcessing: false,
    }))
  }, [])

  /**
   * Export processed video
   */
  const exportVideo = useCallback(() => {
    if (!processedVideo) return

    const url = URL.createObjectURL(processedVideo)
    const a = document.createElement('a')
    a.href = url
    a.download = `dithered_${videoFile?.name || 'video.mp4'}`
    a.click()

    URL.revokeObjectURL(url)
  }, [processedVideo, videoFile])

  return {
    uploadVideo,
    videoMetadata,
    parameters,
    updateParameters,
    startProcessing,
    cancelProcessing,
    exportVideo,
    processingState,
    processedVideo,
  }
}
