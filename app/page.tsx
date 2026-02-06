'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { FloydSteinbergDithering } from '@/lib/dithering/floyd-steinberg'
import { PRESET_PALETTES } from '@/lib/dithering/color-quantization'
import { useVideoProcessor } from '@/hooks/useVideoProcessor'
import { VideoProcessingProgress } from '@/components/video/VideoProcessingProgress'
import { ExportControls } from '@/components/video/ExportControls'

export default function Home() {
  const [mode, setMode] = useState<'image' | 'video'>('image')
  const [selectedPalette, setSelectedPalette] = useState<string>('monochrome')
  const [pixelation, setPixelation] = useState(1)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [threshold, setThreshold] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [previewScale, setPreviewScale] = useState(2.5) // NEW: Preview zoom control

  // Bloom effect controls
  const [bloomEnabled, setBloomEnabled] = useState(false)
  const [bloomIntensity, setBloomIntensity] = useState(0.8)
  const [bloomRadius, setBloomRadius] = useState(4)
  const [bloomThreshold, setBloomThreshold] = useState(0.7)

  const originalCanvasRef = useRef<HTMLCanvasElement>(null)
  const ditheredCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Video processing hook
  const {
    uploadVideo,
    videoMetadata,
    parameters: videoParams,
    updateParameters: updateVideoParams,
    startProcessing,
    cancelProcessing,
    exportVideo,
    processingState,
    processedVideo,
  } = useVideoProcessor()

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = originalCanvasRef.current
        if (!canvas) return

        // Set canvas size to image size
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Draw original image
        ctx.drawImage(img, 0, 0)

        // Auto-process on load
        processImage()
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  const processImage = useCallback(() => {
    const originalCanvas = originalCanvasRef.current
    const ditheredCanvas = ditheredCanvasRef.current
    if (!originalCanvas || !ditheredCanvas) return

    setProcessing(true)

    // Get original image data
    const ctx = originalCanvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height)

    // Apply Floyd-Steinberg dithering
    const palette = PRESET_PALETTES[selectedPalette as keyof typeof PRESET_PALETTES]

    const dithering = new FloydSteinbergDithering({
      palette,
      width: imageData.width,
      height: imageData.height,
      pixelation,
      brightness,
      contrast,
      threshold,
      bloom: bloomEnabled ? {
        intensity: bloomIntensity,
        radius: bloomRadius,
        threshold: bloomThreshold
      } : undefined,
    })

    const processedImageData = dithering.dither(imageData)
    dithering.dispose()

    // Draw dithered image
    ditheredCanvas.width = originalCanvas.width
    ditheredCanvas.height = originalCanvas.height
    const ditheredCtx = ditheredCanvas.getContext('2d')
    if (!ditheredCtx) return

    ditheredCtx.putImageData(processedImageData, 0, 0)

    setProcessing(false)
  }, [selectedPalette, pixelation, brightness, contrast, threshold, bloomEnabled, bloomIntensity, bloomRadius, bloomThreshold])

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    await uploadVideo(file)
  }, [uploadVideo])

  // Sync video parameters with image parameters
  useEffect(() => {
    if (mode === 'video') {
      updateVideoParams({
        palettePreset: selectedPalette,
        pixelation,
        brightness,
        contrast,
        threshold,
        bloom: bloomEnabled ? {
          intensity: bloomIntensity,
          radius: bloomRadius,
          threshold: bloomThreshold
        } : undefined,
      })
    }
  }, [mode, selectedPalette, pixelation, brightness, contrast, threshold, bloomEnabled, bloomIntensity, bloomRadius, bloomThreshold, updateVideoParams])

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Floyd-Steinberg Video Dithering Tool</h1>

        {/* Mode Toggle */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setMode('image')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              mode === 'image'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Image Mode
          </button>
          <button
            onClick={() => setMode('video')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              mode === 'video'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Video Mode
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Upload & Controls */}
          <div className="space-y-6">
            {/* Upload */}
            {mode === 'image' ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4">Upload Image (Test)</h2>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full p-2 border rounded"
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold mb-4">Upload Video</h2>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="w-full p-2 border rounded"
                />
                {videoMetadata && (
                  <div className="mt-4 p-4 bg-gray-50 rounded space-y-1 text-sm">
                    <p><strong>Resolution:</strong> {videoMetadata.width}x{videoMetadata.height}</p>
                    <p><strong>FPS:</strong> {videoMetadata.fps.toFixed(2)}</p>
                    <p><strong>Duration:</strong> {videoMetadata.duration.toFixed(2)}s</p>
                    <p><strong>Total Frames:</strong> {videoMetadata.totalFrames}</p>
                  </div>
                )}
              </div>
            )}

            {/* Parameters */}
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <h2 className="text-2xl font-semibold mb-4">Parameters</h2>

              {/* Palette */}
              <div>
                <label className="block text-sm font-medium mb-2">Color Palette</label>
                <select
                  value={selectedPalette}
                  onChange={(e) => setSelectedPalette(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  {Object.keys(PRESET_PALETTES).map(preset => (
                    <option key={preset} value={preset}>
                      {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pixelation */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Pixelation: {pixelation}
                </label>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={pixelation}
                  onChange={(e) => setPixelation(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Brightness */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Brightness: {brightness}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Contrast */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Contrast: {contrast}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Threshold */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Threshold: {threshold}
                </label>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Preview Zoom */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium mb-2">
                  Preview Zoom: {previewScale}x
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={previewScale}
                  onChange={(e) => setPreviewScale(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enlarge dithered preview to see pixelation detail
                </p>
              </div>

              {/* Bloom Effect */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <h3 className="text-lg font-semibold">Bloom Effect</h3>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bloomEnabled}
                    onChange={(e) => setBloomEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Enable Bloom</span>
                </label>

                {bloomEnabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                    {/* Intensity */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Intensity: {bloomIntensity.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={bloomIntensity}
                        onChange={(e) => setBloomIntensity(Number(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">Glow strength</p>
                    </div>

                    {/* Radius */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Radius: {bloomRadius}px
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={bloomRadius}
                        onChange={(e) => setBloomRadius(Number(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">Blur spread</p>
                    </div>

                    {/* Threshold */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Threshold: {bloomThreshold.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={bloomThreshold}
                        onChange={(e) => setBloomThreshold(Number(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">Brightness cutoff</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={mode === 'image' ? processImage : startProcessing}
                disabled={processing || (mode === 'video' && (!videoMetadata || processingState.isProcessing))}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {mode === 'image'
                  ? (processing ? 'Processing...' : 'Apply Dithering')
                  : (processingState.isProcessing ? 'Processing Video...' : 'Process Video')}
              </button>
            </div>
          </div>

          {/* Right Column: Preview / Video Processing */}
          <div className="space-y-6">
            {mode === 'image' ? (
              <>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-semibold mb-4">Original</h2>
                  <canvas
                    ref={originalCanvasRef}
                    className="w-full border rounded"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-semibold mb-4">
                    Dithered (Zoomed {previewScale}x)
                  </h2>
                  <div className="overflow-auto max-h-[800px] border rounded bg-gray-100 p-4">
                    <canvas
                      ref={ditheredCanvasRef}
                      style={{
                        imageRendering: 'pixelated',
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                        display: 'block'
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Scroll to see entire preview when zoomed
                  </p>
                </div>
              </>
            ) : (
              <>
                <VideoProcessingProgress
                  currentFrame={processingState.currentFrame}
                  totalFrames={processingState.totalFrames}
                  progress={processingState.progress}
                  estimatedTimeRemaining={processingState.estimatedTimeRemaining}
                  isProcessing={processingState.isProcessing}
                  onCancel={cancelProcessing}
                />

                <ExportControls
                  processedVideo={processedVideo}
                  onExport={exportVideo}
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2 text-green-800">✨ All Features Implemented</h3>
          <p className="text-sm text-gray-700">
            ✅ Floyd-Steinberg error diffusion dithering<br />
            ✅ 7 color palettes (Monochrome, CGA, Game Boy, etc.)<br />
            ✅ Full video processing pipeline with FFmpeg<br />
            ✅ Web Workers parallelization (up to 8 workers)<br />
            ✅ WebGL bloom & light ray effects<br />
            ✅ 2.5x preview zoom to see pixelation detail<br />
            ✅ Real-time progress tracking & ETA<br />
            ✅ Export to After Effects-compatible MP4
          </p>
        </div>
      </div>
    </main>
  )
}
