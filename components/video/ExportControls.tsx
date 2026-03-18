'use client'

import { useRef, useEffect } from 'react'

interface ExportControlsProps {
  processedVideo: Blob | null
  onExport: () => void
}

export function ExportControls({ processedVideo, onExport }: ExportControlsProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (processedVideo && videoRef.current) {
      const url = URL.createObjectURL(processedVideo)
      videoRef.current.src = url
      // Revoke the object URL on cleanup to release memory
      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [processedVideo])

  if (!processedVideo) {
    return null
  }

  const fileSizeMB = (processedVideo.size / (1024 * 1024)).toFixed(2)

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-2xl font-semibold mb-4">Export Video</h2>

      {/* ── VIDEO PREVIEW ────────────────────────────────────────
          paddingTop: 56.25% = 16:9 aspect ratio container trick.
          The absolute-positioned video fills this space.
          bg-black: true black letterbox behind the video.
          border border-[#212121]: edge visible against dark card.
          overflow-hidden: clips the video to the rounded corners.
          rounded-[8px]: per spec, 8px for smaller elements.
      */}
      <div
        className="relative w-full border border-[#212121] rounded-[8px] overflow-hidden bg-black"
        style={{ paddingTop: '56.25%' }}
      >
        <video
          ref={videoRef}
          controls
          className="absolute inset-0 w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* File size — muted text, supplementary info */}
      <div className="text-sm text-[#666]">
        <p>File Size: <span className="font-mono text-[#999]">{fileSizeMB} MB</span></p>
      </div>

      {/* ── DOWNLOAD BUTTON ──────────────────────────────────────
          bg-[#55FF00] text-black: accent green with black text.
          glow-green: hover glow from globals.css box-shadow rule.
            This button is NOT inside overflow-hidden, so the glow
            renders correctly (unlike the progress bar fill).
          hover:brightness-110: +10% brightness on hover via CSS filter.
          rounded-[8px]: per spec.
      */}
      <button
        onClick={onExport}
        className="w-full px-6 py-3 bg-[#55FF00] text-black font-semibold rounded-[8px] hover:brightness-110 glow-green flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download Dithered Video
      </button>

      <p className="text-xs text-[#555] text-center">
        Video is optimized for After Effects (H.264, yuv420p)
      </p>
    </div>
  )
}
