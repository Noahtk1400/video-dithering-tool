import type { WorkerMessage, WorkerResponse } from '@/types/worker.types'

export class WorkerPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private taskQueue: Array<{
    message: WorkerMessage
    resolve: (value: WorkerResponse) => void
    reject: (error: Error) => void
  }> = []

  constructor(workerCount: number = navigator.hardwareConcurrency || 4) {
    // Create worker pool (limit to prevent memory issues)
    const maxWorkers = Math.min(workerCount, 8)

    for (let i = 0; i < maxWorkers; i++) {
      const worker = new Worker(
        new URL('./frame-processor.worker.ts', import.meta.url),
        { type: 'module' }
      )

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        this.handleWorkerResponse(worker, e.data)
      }

      worker.onerror = (error) => {
        console.error('Worker error:', error)
      }

      this.workers.push(worker)
      this.availableWorkers.push(worker)
    }
  }

  /**
   * Process frame using available worker
   */
  async processFrame(message: WorkerMessage): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ message, resolve, reject })
      this.processNextTask()
    })
  }

  /**
   * Process next queued task
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return
    }

    const worker = this.availableWorkers.shift()!
    const task = this.taskQueue.shift()!

    // Store task resolution handlers
    ;(worker as any).__currentTask = task

    // Send message to worker
    worker.postMessage(task.message, { transfer: [task.message.imageData.data.buffer] })
  }

  /**
   * Handle worker response
   */
  private handleWorkerResponse(worker: Worker, response: WorkerResponse): void {
    const task = (worker as any).__currentTask

    if (task) {
      if (response.success) {
        task.resolve(response)
      } else {
        task.reject(new Error(response.error || 'Worker processing failed'))
      }

      ;(worker as any).__currentTask = null
    }

    // Return worker to pool
    this.availableWorkers.push(worker)

    // Process next task
    this.processNextTask()
  }

  /**
   * Terminate all workers
   */
  dispose(): void {
    this.workers.forEach(worker => worker.terminate())
    this.workers = []
    this.availableWorkers = []
    this.taskQueue = []
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
      busyWorkers: this.workers.length - this.availableWorkers.length,
    }
  }
}
