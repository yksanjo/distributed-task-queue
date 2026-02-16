/**
 * Worker - Processes tasks from the queue
 */

import { Task, TaskProcessor, WorkerOptions } from '../core/types';
import { TaskQueue } from '../queue/task-queue';

export class Worker<T = any, R = any> {
  private id: string;
  private queue: TaskQueue<T>;
  private processor: TaskProcessor<T, R>;
  private concurrency: number;
  private pollingInterval: number;
  private running: boolean = false;
  private activeTasks: Set<string> = new Set();

  constructor(
    queue: TaskQueue<T>,
    processor: TaskProcessor<T, R>,
    options: WorkerOptions
  ) {
    this.id = options.id;
    this.queue = queue;
    this.processor = processor;
    this.concurrency = options.concurrency || 1;
    this.pollingInterval = options.pollingInterval || 1000;
  }

  /**
   * Start processing tasks
   */
  start(): void {
    this.running = true;
    this.processLoop();
  }

  /**
   * Stop processing tasks
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get number of active tasks
   */
  getActiveCount(): number {
    return this.activeTasks.size;
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      // Process up to concurrency limit
      while (this.activeTasks.size < this.concurrency) {
        const task = this.queue.dequeue();
        if (!task) break;
        
        this.activeTasks.add(task.id);
        this.processTask(task);
      }

      // Wait before next polling
      await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
    }
  }

  private async processTask(task: Task<T>): Promise<void> {
    try {
      // Process with timeout
      const result = await this.processWithTimeout(task);
      
      // Mark as completed
      this.queue.complete(task.id, result);
    } catch (error) {
      // Mark as failed
      this.queue.fail(task.id, (error as Error).message);
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  private async processWithTimeout(task: Task<T>): Promise<R> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out`));
      }, 30000);

      try {
        const result = await this.processor(task.payload);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

/**
 * Worker Pool - Manages multiple workers
 */
export class WorkerPool<T = any, R = any> {
  private workers: Worker<T, R>[] = [];

  constructor() {}

  /**
   * Add a worker to the pool
   */
  addWorker(worker: Worker<T, R>): void {
    this.workers.push(worker);
  }

  /**
   * Start all workers
   */
  startAll(): void {
    this.workers.forEach(w => w.start());
  }

  /**
   * Stop all workers
   */
  stopAll(): void {
    this.workers.forEach(w => w.stop());
  }

  /**
   * Get total active task count across all workers
   */
  getTotalActiveCount(): number {
    return this.workers.reduce((sum, w) => sum + w.getActiveCount(), 0);
  }

  /**
   * Get worker count
   */
  getWorkerCount(): number {
    return this.workers.length;
  }
}
