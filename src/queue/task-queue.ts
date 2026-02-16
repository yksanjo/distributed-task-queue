/**
 * Task Queue - Priority-based distributed task queue
 */

import { Task, TaskStatus, QueueOptions, QueueMetrics, RetryPolicy } from '../core/types';

export class TaskQueue<T = any> {
  private name: string;
  private tasks: Map<string, Task<T>> = new Map();
  private pendingQueue: Task<T>[] = [];
  private maxRetries: number;
  private defaultPriority: number;
  private processTimeout: number;
  private idCounter: number = 0;

  constructor(options: QueueOptions) {
    this.name = options.name;
    this.maxRetries = options.maxRetries || 3;
    this.defaultPriority = options.defaultPriority || 0;
    this.processTimeout = options.processTimeout || 30000;
  }

  /**
   * Add a task to the queue
   */
  enqueue(payload: T, priority?: number, maxRetries?: number): string {
    const id = `${this.name}-${++this.idCounter}`;
    
    const task: Task<T> = {
      id,
      payload,
      priority: priority ?? this.defaultPriority,
      status: 'pending',
      retries: 0,
      maxRetries: maxRetries ?? this.maxRetries,
      createdAt: Date.now()
    };

    this.tasks.set(id, task);
    this.pendingQueue.push(task);
    this.pendingQueue.sort((a, b) => b.priority - a.priority);

    return id;
  }

  /**
   * Get next task from queue
   */
  dequeue(): Task<T> | undefined {
    const task = this.pendingQueue.shift();
    if (task) {
      task.status = 'processing';
      task.startedAt = Date.now();
    }
    return task;
  }

  /**
   * Mark task as completed
   */
  complete(taskId: string, result?: any): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'completed';
    task.completedAt = Date.now();
    task.result = result;
    return true;
  }

  /**
   * Mark task as failed
   */
  fail(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.retries++;
    
    if (task.retries < task.maxRetries) {
      task.status = 'retry';
      task.error = error;
      // Re-queue with same priority
      this.pendingQueue.push(task);
    } else {
      task.status = 'failed';
      task.error = error;
      task.completedAt = Date.now();
    }
    
    return true;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task<T> | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    const tasks = Array.from(this.tasks.values());
    
    const completed = tasks.filter(t => t.status === 'completed');
    const completedTimes = completed
      .filter(t => t.startedAt && t.completedAt)
      .map(t => t.completedAt! - t.startedAt!);
    
    const avgTime = completedTimes.length > 0
      ? completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length
      : 0;

    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      processingTasks: tasks.filter(t => t.status === 'processing').length,
      completedTasks: completed.length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      averageProcessingTime: avgTime
    };
  }

  /**
   * Get queue name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): number {
    let count = 0;
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed') {
        this.tasks.delete(id);
        count++;
      }
    }
    return count;
  }
}

/**
 * Multi-Queue Manager
 */
export class QueueManager {
  private queues: Map<string, TaskQueue> = new Map();

  createQueue<T>(options: QueueOptions): TaskQueue<T> {
    const queue = new TaskQueue<T>(options);
    this.queues.set(options.name, queue);
    return queue;
  }

  getQueue<T>(name: string): TaskQueue<T> | undefined {
    return this.queues.get(name);
  }

  deleteQueue(name: string): boolean {
    return this.queues.delete(name);
  }

  getAllQueues(): string[] {
    return Array.from(this.queues.keys());
  }
}
