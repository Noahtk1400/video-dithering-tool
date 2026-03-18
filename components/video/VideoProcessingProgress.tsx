'use client'

interface VideoProcessingProgressProps {
  currentFrame: number
  totalFrames: number
  progress: number
  estimatedTimeRemaining: number // ms
  isProcessing: boolean
  onCancel: () => void
}

export function VideoProcessingProgress({
  currentFrame,
  totalFrames,
  progress,
  estimatedTimeRemaining,
  isProcessing,
  onCancel,
}: VideoProcessingProgressProps) {
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }

  // Don't render anything until processing starts
  if (!isProcessing && currentFrame === 0) {
    return null
  }

  return (
    /*
      glass-card: frosted dark glass card from globals.css.
      No shadow classes needed — glass-card handles the visual.
    */
    <div className="glass-card p-6">
      <h2 className="text-2xl font-semibold mb-4">Processing Video</h2>

      {/* ── PROGRESS BAR ─────────────────────────────────────────
          Track: bg-[#111] — near-black so the green fill stands out.
          h-3: slightly thinner than original (h-4). Cleaner on dark bg.
          overflow-hidden: clips the fill div to the track's rounded shape.

          BUG FIX (Bug 3): Do NOT add box-shadow to the fill div.
          The track has overflow-hidden which would clip any box-shadow
          on children, making it invisible. The green #55FF00 fill is
          visually sufficient — no glow needed here.

          border border-[#212121]: hairline track border distinguishes
          the track from the very dark card background.
      */}
      <div className="mb-4">
        <div className="w-full bg-[#111] rounded-full h-3 overflow-hidden border border-[#212121]">
          <div
            className="bg-[#55FF00] h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── STATS ─────────────────────────────────────────────────
          Labels: text-[#999] — muted, secondary.
          Values: text-[#ccc] — slightly brighter, primary.
          font-mono: prevents layout shift as numbers update
          (monospaced digits all have the same width).
      */}
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-[#999]">Frame:</span>
          <span className="font-mono text-[#ccc]">{currentFrame} / {totalFrames}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#999]">Progress:</span>
          <span className="font-mono text-[#ccc]">{progress.toFixed(1)}%</span>
        </div>
        {estimatedTimeRemaining > 0 && (
          <div className="flex justify-between">
            <span className="text-[#999]">Est. Time Remaining:</span>
            <span className="font-mono text-[#ccc]">{formatTime(estimatedTimeRemaining)}</span>
          </div>
        )}
      </div>

      {/* ── CANCEL BUTTON ─────────────────────────────────────────
          Red color retained: communicates destructive/stop action
          per standard UX conventions. Darkened to red-700 for the
          dark theme (red-600 is too saturated on a dark bg).

          opacity-90 / hover:opacity-100: subtle fade-up on hover.

          BUG FIX (Bug 6): transition-all replaces transition-colors.
          transition-colors only transitions color-related CSS properties
          (color, background-color, border-color). It does NOT transition
          opacity. Without transition-all (or explicit transition-opacity),
          the opacity change would be instantaneous/jarring.
      */}
      {isProcessing && (
        <button
          onClick={onCancel}
          className="w-full px-6 py-3 bg-red-700 text-white rounded-[8px] hover:bg-red-600 opacity-90 hover:opacity-100 font-medium transition-all duration-200"
        >
          Cancel Processing
        </button>
      )}

      {/* Completion state — accent green matches brand */}
      {!isProcessing && currentFrame === totalFrames && (
        <div className="text-[#55FF00] font-medium text-center">
          ✓ Processing Complete
        </div>
      )}
    </div>
  )
}
