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
  const [previewScale, setPreviewScale] = useState(1)

  /*
    BUG FIX (Bug 4 + 5): We need the processed image's native pixel dimensions
    to correctly size the zoomed canvas in layout space.

    Why not just read ditheredCanvasRef.current.width in JSX?
    Because React doesn't re-render when a ref's properties change — only
    state changes trigger re-renders. Storing dimensions in state ensures
    the canvas display updates correctly after processImage() runs.
  */
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null)

  // Bloom effect controls
  const [bloomEnabled, setBloomEnabled] = useState(false)
  const [bloomIntensity, setBloomIntensity] = useState(0.8)
  const [bloomRadius, setBloomRadius] = useState(4)
  const [bloomThreshold, setBloomThreshold] = useState(0.7)

  const originalCanvasRef = useRef<HTMLCanvasElement>(null)
  const ditheredCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
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
    const ctx = originalCanvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height)
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

    ditheredCanvas.width = originalCanvas.width
    ditheredCanvas.height = originalCanvas.height
    const ditheredCtx = ditheredCanvas.getContext('2d')
    if (!ditheredCtx) return
    ditheredCtx.putImageData(processedImageData, 0, 0)

    /*
      BUG FIX (Bug 5): Store the processed canvas dimensions in React state.
      These are the native pixel dimensions of the dithered image. We use them
      in JSX to compute the CSS width/height of the canvas at higher zoom levels,
      so the scroll container sees the correct layout size and shows scrollbars.
    */
    setCanvasSize({ width: ditheredCanvas.width, height: ditheredCanvas.height })

    setProcessing(false)
  }, [selectedPalette, pixelation, brightness, contrast, threshold, bloomEnabled, bloomIntensity, bloomRadius, bloomThreshold])

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadVideo(file)
  }, [uploadVideo])

  // Keep video parameters in sync with the shared image parameter controls
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
    /*
      text-[#f0f0f0]: sets default text color for the entire page subtree.
      The body rule in globals.css also sets color: #f0f0f0, so this is
      belt-and-suspenders — it prevents any Tailwind Preflight reset from
      overriding inside this subtree.
    */
    <main className="min-h-screen p-8 text-[#f0f0f0]">
      <div className="max-w-7xl mx-auto">

        {/* ── PAGE TITLE ─────────────────────────────────────────────
            letter-spacing: -0.04em is applied globally to h1 via
            globals.css. No extra class needed here.
        */}
        <h1 className="text-4xl font-bold mb-8">
          Floyd-Steinberg Video Dithering Tool
        </h1>

        {/* ── MODE TOGGLE ────────────────────────────────────────────
            Active button:
              - bg-[#55FF00]: accent green background
              - text-black: black text for contrast (WCAG AA compliant
                on #55FF00 — bright green passes with dark text)
              - glow-green: hover glow from globals.css

            Inactive button:
              - bg-[#1c1c1c]: same as card surface (buttons sit inside card)
              - border border-[#212121]: hairline border distinguishes it
              - text-[#888]: muted gray, clearly inactive
              - No glow-green: only the currently active state glows

            rounded-[8px]: per spec, 8px for smaller UI elements.
        */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setMode('image')}
            className={`px-6 py-3 rounded-[8px] font-medium transition-colors ${
              mode === 'image'
                ? 'bg-[#55FF00] text-black font-semibold glow-green'
                : 'bg-[#1c1c1c] text-[#888] border border-[#212121] hover:border-[#333]'
            }`}
          >
            Image Mode
          </button>
          <button
            onClick={() => setMode('video')}
            className={`px-6 py-3 rounded-[8px] font-medium transition-colors ${
              mode === 'video'
                ? 'bg-[#55FF00] text-black font-semibold glow-green'
                : 'bg-[#1c1c1c] text-[#888] border border-[#212121] hover:border-[#333]'
            }`}
          >
            Video Mode
          </button>
        </div>

        {/* Responsive grid: 1 column on mobile, 2 on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT COLUMN: Upload + Controls */}
          <div className="space-y-6">

            {/* ── UPLOAD CARD ──────────────────────────────────────
                glass-card: dark frosted glass (see globals.css).
                File input is styled globally in globals.css — no
                extra className needed on the input element itself.
            */}
            {mode === 'image' ? (
              <div className="glass-card p-6">
                <h2 className="text-2xl font-semibold mb-4">Upload Image</h2>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
            ) : (
              <div className="glass-card p-6">
                <h2 className="text-2xl font-semibold mb-4">Upload Video</h2>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                />
                {/* Video metadata — dark inset panel with 8px radius */}
                {videoMetadata && (
                  <div className="mt-4 p-4 bg-[#111] rounded-[8px] border border-[#212121] space-y-1 text-sm">
                    <p className="text-[#999]"><strong className="text-[#ccc]">Resolution:</strong> {videoMetadata.width}x{videoMetadata.height}</p>
                    <p className="text-[#999]"><strong className="text-[#ccc]">FPS:</strong> {videoMetadata.fps.toFixed(2)}</p>
                    <p className="text-[#999]"><strong className="text-[#ccc]">Duration:</strong> {videoMetadata.duration.toFixed(2)}s</p>
                    <p className="text-[#999]"><strong className="text-[#ccc]">Total Frames:</strong> {videoMetadata.totalFrames}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── PARAMETERS CARD ──────────────────────────────────
                All sliders are tinted green via globals.css accent-color.
                The select dropdown is styled dark via globals.css.
                Labels use text-[#ccc] — readable but not glaring.
            */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-2xl font-semibold mb-4">Parameters</h2>

              {/* Palette dropdown — dark styled via globals.css select rule */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[#ccc]">Color Palette</label>
                <select
                  value={selectedPalette}
                  onChange={(e) => setSelectedPalette(e.target.value)}
                  className="w-full"
                >
                  {Object.keys(PRESET_PALETTES).map(preset => (
                    <option key={preset} value={preset}>
                      {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pixelation — range fills green via globals.css accent-color */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[#ccc]">
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

              <div>
                <label className="block text-sm font-medium mb-2 text-[#ccc]">
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

              <div>
                <label className="block text-sm font-medium mb-2 text-[#ccc]">
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

              <div>
                <label className="block text-sm font-medium mb-2 text-[#ccc]">
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

              {/* ── PREVIEW ZOOM SLIDER ─────────────────────────────
                  At previewScale = 1: canvas is fit-to-container (shows
                  the full image, no scrolling needed).
                  At previewScale > 1: canvas is rendered at
                  nativeWidth * scale, enabling scroll-to-pan.

                  This border-t visually separates zoom from dithering params.
              */}
              <div className="border-t border-[#212121] pt-4 mt-4">
                <label className="block text-sm font-medium mb-2 text-[#ccc]">
                  Preview Zoom: {previewScale === 1 ? 'Full View' : `${previewScale}x`}
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
                <p className="text-xs text-[#555] mt-1">
                  {previewScale === 1
                    ? 'Showing full image — drag slider to zoom in'
                    : 'Scroll inside the preview to pan around'}
                </p>
              </div>

              {/* ── BLOOM EFFECT ────────────────────────────────────
                  border-l-2 border-[#55FF00]/30: 30% opacity accent green
                  left border — visually groups the bloom sub-controls
                  without being visually loud.
                  Syntax: border-[#55FF00]/30 = rgb(85 255 0 / 0.3)
              */}
              <div className="border-t border-[#212121] pt-4 mt-4 space-y-4">
                <h3 className="text-lg font-semibold">Bloom Effect</h3>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bloomEnabled}
                    onChange={(e) => setBloomEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-[#ccc]">Enable Bloom</span>
                </label>

                {bloomEnabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-[#55FF00]/30">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[#ccc]">
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
                      <p className="text-xs text-[#555] mt-1">Glow strength</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-[#ccc]">
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
                      <p className="text-xs text-[#555] mt-1">Blur spread</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-[#ccc]">
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
                      <p className="text-xs text-[#555] mt-1">Brightness cutoff</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── PRIMARY ACTION BUTTON ────────────────────────────
                  bg-[#55FF00] text-black: bright green with black text.
                  hover:brightness-110: lightens the green 10% on hover
                  using CSS filter — no color value recalculation needed.
                  disabled:opacity-30: fades to 30% when not available.
                  disabled:cursor-not-allowed: signals non-interactability.
                  glow-green: adds the box-shadow halo on hover.
                    Note: this button is NOT inside overflow-hidden, so
                    the glow renders fully visible (unlike progress bar fill).
              */}
              <button
                onClick={mode === 'image' ? processImage : startProcessing}
                disabled={processing || (mode === 'video' && (!videoMetadata || processingState.isProcessing))}
                className="w-full px-6 py-3 bg-[#55FF00] text-black font-semibold rounded-[8px] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed glow-green"
              >
                {mode === 'image'
                  ? (processing ? 'Processing...' : 'Apply Dithering')
                  : (processingState.isProcessing ? 'Processing Video...' : 'Process Video')}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Preview / Video output */}
          <div className="space-y-6">
            {mode === 'image' ? (
              <>
                {/* ── ORIGINAL CANVAS ──────────────────────────────
                    w-full: canvas display width fills the card.
                    The canvas internal resolution is set to the image's
                    native size; CSS w-full scales the display to fit.
                    imageRendering: pixelated: keeps pixels sharp when
                    the display size doesn't match internal resolution.
                */}
                <div className="glass-card p-6">
                  <h2 className="text-2xl font-semibold mb-4">Original</h2>
                  <canvas
                    ref={originalCanvasRef}
                    className="w-full border border-[#212121] rounded-[8px]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                {/* ── DITHERED CANVAS (ZOOMABLE + PANNABLE) ────────
                    BUG FIX (Bug 4): Old code used transform: scale() which
                    is visual-only — it doesn't change layout size. The
                    overflow-auto container never showed scrollbars because
                    it still saw the original (unscaled) canvas dimensions.

                    New approach: set CSS width/height directly on the canvas.
                    For a <canvas> element:
                      - canvas.width / canvas.height attributes = drawing buffer
                        (the internal pixel grid, set to the image's native size)
                      - CSS width / CSS height = display size on screen
                    These are independent. Setting CSS width = nativeWidth * scale
                    makes the canvas visually larger while keeping pixel data intact.
                    The overflow-auto container sees the real layout dimensions and
                    shows scrollbars correctly → scroll-to-pan works.

                    At previewScale = 1 (fit mode):
                      CSS width: 100% → scales down to fit the card (shows full image)
                      CSS height: auto → maintains aspect ratio naturally
                      No scrollbars needed.

                    At previewScale > 1 (zoom mode):
                      CSS width: canvasSize.width * previewScale
                      CSS height: canvasSize.height * previewScale
                      Container overflow:auto → scrollbars appear → scroll to pan.

                    maxHeight at zoom mode: caps the scroll region so the UI
                    doesn't take over the whole screen. At fit mode (scale=1):
                    no maxHeight, so the full image is always visible.
                */}
                <div className="glass-card p-6">
                  <h2 className="text-2xl font-semibold mb-4">
                    Dithered {previewScale > 1 ? `(${previewScale}x Zoom)` : '(Full View)'}
                  </h2>
                  <div
                    className="overflow-auto border border-[#212121] rounded-[8px] bg-[#111] p-4"
                    style={{
                      // At fit mode: no height cap — show the entire image
                      // At zoom mode: cap at 700px so the card doesn't fill the screen
                      maxHeight: previewScale > 1 ? '700px' : 'none',
                    }}
                  >
                    <canvas
                      ref={ditheredCanvasRef}
                      style={{
                        imageRendering: 'pixelated',
                        display: 'block',
                        /*
                          BUG FIX (Bug 4 + 5):
                          previewScale === 1 → fit to container width (show full image)
                          previewScale > 1 → actual pixel dimensions × scale (enable pan)

                          If canvasSize is null (no image loaded yet), fall back to
                          '100%' width so the canvas area doesn't look broken.
                        */
                        width: previewScale <= 1
                          ? '100%'
                          : (canvasSize ? canvasSize.width * previewScale : '100%'),
                        height: previewScale <= 1
                          ? 'auto'
                          : (canvasSize ? canvasSize.height * previewScale : 'auto'),
                      }}
                    />
                  </div>
                  <p className="text-xs text-[#555] mt-2">
                    {previewScale > 1
                      ? 'Scroll or drag scrollbars inside the preview to pan'
                      : 'Use the zoom slider above to inspect pixel detail'}
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

        {/* ── FEATURES FOOTER ──────────────────────────────────────────
            bg-[#0f1a0a]: very dark green-tinted panel.
            border-[#1a3012]: dark forest green border.
            Heading in accent green. Body text muted at #999.
            rounded-[16px]: matches card radius spec.
        */}
        <div className="mt-8 bg-[#0f1a0a] border border-[#1a3012] rounded-[16px] p-4">
          <h3 className="font-semibold mb-2 text-[#55FF00]">✨ All Features Implemented</h3>
          <p className="text-sm text-[#999]">
            ✅ Floyd-Steinberg error diffusion dithering<br />
            ✅ 7 color palettes (Monochrome, CGA, Game Boy, etc.)<br />
            ✅ Full video processing pipeline with FFmpeg<br />
            ✅ Web Workers parallelization (up to 8 workers)<br />
            ✅ WebGL bloom &amp; light ray effects<br />
            ✅ Full-image preview at 1x, scroll-to-pan when zoomed<br />
            ✅ Real-time progress tracking &amp; ETA<br />
            ✅ Export to After Effects-compatible MP4
          </p>
        </div>
      </div>
    </main>
  )
}
