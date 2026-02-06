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

  if (!isProcessing && currentFrame === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-4">Processing Video</h2>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 text-sm text-gray-700 mb-4">
        <div className="flex justify-between">
          <span>Frame:</span>
          <span className="font-mono">
            {currentFrame} / {totalFrames}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Progress:</span>
          <span className="font-mono">{progress.toFixed(1)}%</span>
        </div>
        {estimatedTimeRemaining > 0 && (
          <div className="flex justify-between">
            <span>Est. Time Remaining:</span>
            <span className="font-mono">{formatTime(estimatedTimeRemaining)}</span>
          </div>
        )}
      </div>

      {/* Cancel Button */}
      {isProcessing && (
        <button
          onClick={onCancel}
          className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
        >
          Cancel Processing
        </button>
      )}

      {!isProcessing && currentFrame === totalFrames && (
        <div className="text-green-600 font-medium text-center">
          ✓ Processing Complete
        </div>
      )}
    </div>
  )
}
