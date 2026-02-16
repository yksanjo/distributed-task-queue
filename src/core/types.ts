/**
 * Core Type Definitions for Distributed Task Queue
 */

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retry';

export interface Task<T = any> {
  id: string;
  payload: T;
  priority: number;
  status: TaskStatus;
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
}

export interface QueueOptions {
  name: string;
  maxRetries?: number;
  defaultPriority?: number;
  processTimeout?: number;
}

export interface WorkerOptions {
  id: string;
  concurrency?: number;
  pollingInterval?: number;
}

export interface TaskProcessor<T = any, R = any> {
  (payload: T): Promise<R>;
}

export interface QueueMetrics {
  totalTasks: number;
  pendingTasks: number;
  processingTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}
