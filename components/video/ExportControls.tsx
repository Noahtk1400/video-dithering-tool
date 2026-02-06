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
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-2xl font-semibold mb-4">Export Video</h2>

      {/* Video Preview - Fixed 16:9 Aspect Ratio */}
      <div className="relative w-full border rounded overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
        <video
          ref={videoRef}
          controls
          className="absolute inset-0 w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* File Info */}
      <div className="text-sm text-gray-600">
        <p>File Size: <span className="font-mono">{fileSizeMB} MB</span></p>
      </div>

      {/* Export Button */}
      <button
        onClick={onExport}
        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center justify-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download Dithered Video
      </button>

      <p className="text-xs text-gray-500 text-center">
        Video is optimized for After Effects (H.264, yuv420p)
      </p>
    </div>
  )
}
