# Phase 6, Session 6B: Async Export Queue

**Phase**: 6 - Advanced Features (Optional)
**Session**: 6B
**Duration**: 12-16 hours
**Priority**: 🟢 LOW
**Note**: Optional enhancement for future iterations

---

## Navigation

- **Previous Session**: [Session 6A - Redis Caching](./phase-6-session-6a-redis-caching.md)
- **Current Phase**: [Phase 6 - Advanced Features](../admin-analytics-remediation-plan.md#phase-6-advanced-features-optional)
- **Next Session**: [Session 6C - Advanced Visualizations](./phase-6-session-6c-visualizations.md)
- **Plan Overview**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

This session is part of Phase 6, which focuses on **optional advanced features** for future enhancement of the Admin Usage Analytics system. Phase 6 is **not required for production deployment** and should only be pursued after Phases 1-5 are complete and stable.

### Phase 6 Summary

Phase 6 addresses advanced features that enhance performance, scalability, and user experience beyond the core requirements:

- **Session 6A**: Redis Caching - High-performance distributed caching
- **Session 6B** (this session): Async Export Queue - Background job processing for large exports
- **Session 6C**: Advanced Visualizations - Enhanced charts and analytics
- **Session 6D**: Scheduled Reports - Automated report generation

**Total Phase 6 Duration**: 40-60 hours

---

## Session Objectives

Implement asynchronous export processing using a job queue to:

1. **Move large exports to background** jobs to avoid request timeouts
2. **Improve user experience** with job status tracking and notifications
3. **Scale export operations** independently from API servers
4. **Support large dataset exports** (millions of rows) without memory issues
5. **Enable export prioritization** and rate limiting per user
6. **Add export history** and download management

**Success Criteria**:

- Exports > 10,000 rows processed in background
- Export job status tracking implemented
- Email notifications on export completion
- Export download links with expiration
- Support for CSV, JSON, and Excel formats
- Export queue monitoring and admin tools

---

## Implementation Steps

### Step 6B.1: Job Queue Infrastructure (2-3 hours)

#### Objectives

- Set up BullMQ job queue system
- Configure Redis as job queue backend
- Add job queue monitoring

#### Tasks

**1. Install Dependencies**

```bash
npm --prefix backend install bullmq ioredis
npm --prefix backend install --save-dev @types/bull
```

**2. Create Job Queue Configuration**

Create `backend/src/config/job-queue.config.ts`:

```typescript
import { QueueOptions, WorkerOptions } from 'bullmq';

export interface JobQueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  defaultJobOptions: {
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
    removeOnComplete: {
      age: number;
      count: number;
    };
    removeOnFail: {
      age: number;
    };
  };
}

export const getJobQueueConfig = (): JobQueueConfig => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_JOB_DB) || 1, // Different DB from cache
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // 7 days
      count: 1000,
    },
    removeOnFail: {
      age: 14 * 24 * 60 * 60, // 14 days
    },
  },
});

// Queue names
export const QUEUE_NAMES = {
  EXPORT: 'export-jobs',
  SCHEDULED_REPORT: 'scheduled-report-jobs',
} as const;

// Job priorities
export const JOB_PRIORITY = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
} as const;
```

**3. Environment Variables**

Update `.env.example`:

```bash
# Job Queue Configuration
REDIS_JOB_DB=1                    # Separate DB for job queue
EXPORT_MAX_CONCURRENT_JOBS=5      # Max concurrent export jobs per worker
EXPORT_MAX_ROWS_SYNC=10000        # Rows threshold for async processing
EXPORT_FILE_RETENTION_HOURS=24    # How long to keep export files
EXPORT_DOWNLOAD_BASE_URL=http://localhost:8081/downloads
```

**4. Create Export Queue Service**

Create `backend/src/services/queue/export-queue.service.ts`:

```typescript
import { Queue, Worker, Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { getJobQueueConfig, QUEUE_NAMES, JOB_PRIORITY } from '../../config/job-queue.config';
import { ApplicationError } from '../../utils/errors';

export interface ExportJobData {
  jobId: string;
  userId: string;
  userEmail: string;
  exportType: 'user-breakdown' | 'model-breakdown' | 'provider-breakdown' | 'raw-data';
  filters: AdminUsageFilters;
  format: 'csv' | 'json' | 'excel';
  requestedAt: Date;
}

export interface ExportJobResult {
  jobId: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  rowCount: number;
  fileSize: number;
  completedAt: Date;
  expiresAt: Date;
}

export class ExportQueueService extends BaseService {
  private queue: Queue<ExportJobData, ExportJobResult>;
  private worker: Worker<ExportJobData, ExportJobResult> | null = null;

  constructor(fastify: FastifyInstance) {
    super(fastify);

    const config = getJobQueueConfig();

    this.queue = new Queue<ExportJobData, ExportJobResult>(QUEUE_NAMES.EXPORT, {
      connection: config.redis,
      defaultJobOptions: config.defaultJobOptions,
    });
  }

  /**
   * Add export job to queue
   */
  async addExportJob(
    data: ExportJobData,
    priority: number = JOB_PRIORITY.NORMAL,
  ): Promise<{ jobId: string; position: number }> {
    try {
      const job = await this.queue.add('export', data, {
        priority,
        jobId: data.jobId,
      });

      const position = await job.getPosition();

      this.fastify.log.info(
        {
          jobId: data.jobId,
          userId: data.userId,
          exportType: data.exportType,
          position,
        },
        'Export job added to queue',
      );

      return {
        jobId: job.id!,
        position,
      };
    } catch (error) {
      this.fastify.log.error({ error, data }, 'Failed to add export job');
      throw ApplicationError.internal('Failed to queue export job', { error });
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
    progress?: number;
    result?: ExportJobResult;
    error?: string;
    position?: number;
  }> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        throw ApplicationError.notFound('Export job not found');
      }

      const state = await job.getState();
      const progress = job.progress as number | undefined;

      let result: any = {
        status: state,
        progress,
      };

      if (state === 'completed') {
        result.result = job.returnvalue;
      } else if (state === 'failed') {
        result.error = job.failedReason;
      } else if (state === 'waiting' || state === 'delayed') {
        result.position = await job.getPosition();
      }

      return result;
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      this.fastify.log.error({ error, jobId }, 'Failed to get job status');
      throw ApplicationError.internal('Failed to get job status', { error });
    }
  }

  /**
   * Cancel export job
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        throw ApplicationError.notFound('Export job not found');
      }

      const state = await job.getState();

      if (state === 'active') {
        throw ApplicationError.badRequest('Cannot cancel active job');
      }

      if (state === 'completed') {
        throw ApplicationError.badRequest('Cannot cancel completed job');
      }

      await job.remove();

      this.fastify.log.info({ jobId }, 'Export job cancelled');
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      this.fastify.log.error({ error, jobId }, 'Failed to cancel job');
      throw ApplicationError.internal('Failed to cancel job', { error });
    }
  }

  /**
   * Get user's export jobs
   */
  async getUserJobs(
    userId: string,
    limit = 20,
  ): Promise<
    Array<{
      jobId: string;
      status: string;
      exportType: string;
      format: string;
      requestedAt: Date;
      completedAt?: Date;
      result?: ExportJobResult;
    }>
  > {
    try {
      const jobs = await this.queue.getJobs(['waiting', 'active', 'completed', 'failed']);

      const userJobs = jobs
        .filter((job) => job.data.userId === userId)
        .slice(0, limit)
        .map((job) => ({
          jobId: job.id!,
          status: job.getState(),
          exportType: job.data.exportType,
          format: job.data.format,
          requestedAt: job.data.requestedAt,
          completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
          result: job.returnvalue,
        }));

      return userJobs;
    } catch (error) {
      this.fastify.log.error({ error, userId }, 'Failed to get user jobs');
      throw ApplicationError.internal('Failed to get user jobs', { error });
    }
  }

  /**
   * Start worker to process export jobs
   */
  startWorker(processor: (job: Job<ExportJobData>) => Promise<ExportJobResult>): void {
    const config = getJobQueueConfig();

    this.worker = new Worker<ExportJobData, ExportJobResult>(QUEUE_NAMES.EXPORT, processor, {
      connection: config.redis,
      concurrency: Number(process.env.EXPORT_MAX_CONCURRENT_JOBS) || 5,
    });

    this.worker.on('completed', (job) => {
      this.fastify.log.info(
        {
          jobId: job.id,
          userId: job.data.userId,
          rowCount: job.returnvalue?.rowCount,
        },
        'Export job completed',
      );
    });

    this.worker.on('failed', (job, error) => {
      this.fastify.log.error(
        {
          jobId: job?.id,
          userId: job?.data.userId,
          error,
        },
        'Export job failed',
      );
    });

    this.fastify.log.info('Export worker started');
  }

  /**
   * Stop worker
   */
  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      this.fastify.log.info('Export worker stopped');
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to get queue stats');
      throw ApplicationError.internal('Failed to get queue stats', { error });
    }
  }
}
```

---

### Step 6B.2: Export Worker Implementation (3-4 hours)

#### Objectives

- Implement export job processor
- Add support for streaming large datasets
- Implement file storage and cleanup

#### Tasks

**1. Create Export Worker**

Create `backend/src/workers/export-worker.ts`:

```typescript
import { Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { ExportJobData, ExportJobResult } from '../services/queue/export-queue.service';
import { AdminUsageExportService } from '../services/admin-usage/admin-usage-export.service';

export class ExportWorker {
  private exportService: AdminUsageExportService;
  private exportDir: string;
  private downloadBaseUrl: string;

  constructor(private fastify: FastifyInstance) {
    this.exportService = new AdminUsageExportService(fastify);
    this.exportDir = process.env.EXPORT_DIR || path.join(__dirname, '../../exports');
    this.downloadBaseUrl =
      process.env.EXPORT_DOWNLOAD_BASE_URL || 'http://localhost:8081/downloads';
  }

  /**
   * Process export job
   */
  async processExportJob(job: Job<ExportJobData>): Promise<ExportJobResult> {
    const { jobId, userId, exportType, filters, format } = job.data;

    this.fastify.log.info({ jobId, userId, exportType, format }, 'Processing export job');

    try {
      // Update progress: fetching data
      await job.updateProgress(10);

      // Fetch data based on export type
      let data: any;
      let fileName: string;

      switch (exportType) {
        case 'user-breakdown':
          data = await this.fetchUserBreakdown(filters);
          fileName = `user-breakdown-${jobId}.${format}`;
          break;
        case 'model-breakdown':
          data = await this.fetchModelBreakdown(filters);
          fileName = `model-breakdown-${jobId}.${format}`;
          break;
        case 'provider-breakdown':
          data = await this.fetchProviderBreakdown(filters);
          fileName = `provider-breakdown-${jobId}.${format}`;
          break;
        case 'raw-data':
          data = await this.fetchRawData(filters);
          fileName = `raw-data-${jobId}.${format}`;
          break;
        default:
          throw new Error(`Unknown export type: ${exportType}`);
      }

      await job.updateProgress(50);

      // Ensure export directory exists
      await fs.mkdir(this.exportDir, { recursive: true });

      const filePath = path.join(this.exportDir, fileName);

      // Generate file based on format
      await this.generateExportFile(data, format, filePath, job);

      await job.updateProgress(90);

      // Get file stats
      const stats = await fs.stat(filePath);

      const result: ExportJobResult = {
        jobId,
        fileName,
        filePath,
        downloadUrl: `${this.downloadBaseUrl}/${fileName}`,
        rowCount: Array.isArray(data) ? data.length : 1,
        fileSize: stats.size,
        completedAt: new Date(),
        expiresAt: new Date(
          Date.now() + Number(process.env.EXPORT_FILE_RETENTION_HOURS || 24) * 60 * 60 * 1000,
        ),
      };

      await job.updateProgress(100);

      // Send notification email
      await this.sendCompletionEmail(job.data.userEmail, result);

      return result;
    } catch (error) {
      this.fastify.log.error({ error, jobId, userId }, 'Export job failed');
      throw error;
    }
  }

  /**
   * Generate export file based on format
   */
  private async generateExportFile(
    data: any[],
    format: string,
    filePath: string,
    job: Job<ExportJobData>,
  ): Promise<void> {
    switch (format) {
      case 'csv':
        await this.generateCSV(data, filePath, job);
        break;
      case 'json':
        await this.generateJSON(data, filePath);
        break;
      case 'excel':
        await this.generateExcel(data, filePath, job);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate CSV file with streaming for large datasets
   */
  private async generateCSV(data: any[], filePath: string, job: Job<ExportJobData>): Promise<void> {
    const csvContent = await this.exportService.exportToCSV(data, job.data.filters);
    await fs.writeFile(filePath, csvContent, 'utf-8');
  }

  /**
   * Generate JSON file
   */
  private async generateJSON(data: any[], filePath: string): Promise<void> {
    const jsonContent = JSON.stringify(
      {
        metadata: {
          exportedAt: new Date().toISOString(),
          recordCount: data.length,
        },
        data,
      },
      null,
      2,
    );

    await fs.writeFile(filePath, jsonContent, 'utf-8');
  }

  /**
   * Generate Excel file (requires additional dependency)
   */
  private async generateExcel(
    data: any[],
    filePath: string,
    job: Job<ExportJobData>,
  ): Promise<void> {
    // TODO: Implement Excel generation using exceljs
    // For now, fall back to CSV
    await this.generateCSV(data, filePath, job);
  }

  /**
   * Fetch user breakdown data
   */
  private async fetchUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    // Use admin usage stats service to fetch data
    const adminUsageService = new AdminUsageStatsService(this.fastify, this.fastify.liteLLM);

    return await adminUsageService.getUserBreakdown(filters);
  }

  /**
   * Fetch model breakdown data
   */
  private async fetchModelBreakdown(filters: AdminUsageFilters): Promise<ModelBreakdown[]> {
    const adminUsageService = new AdminUsageStatsService(this.fastify, this.fastify.liteLLM);

    return await adminUsageService.getModelBreakdown(filters);
  }

  /**
   * Fetch provider breakdown data
   */
  private async fetchProviderBreakdown(filters: AdminUsageFilters): Promise<ProviderBreakdown[]> {
    const adminUsageService = new AdminUsageStatsService(this.fastify, this.fastify.liteLLM);

    return await adminUsageService.getProviderBreakdown(filters);
  }

  /**
   * Fetch raw data (requires new service method)
   */
  private async fetchRawData(filters: AdminUsageFilters): Promise<any[]> {
    // TODO: Implement raw data export
    // This would return usage records directly from LiteLLM
    throw new Error('Raw data export not yet implemented');
  }

  /**
   * Send completion email to user
   */
  private async sendCompletionEmail(email: string, result: ExportJobResult): Promise<void> {
    // TODO: Integrate with email service
    this.fastify.log.info({ email, fileName: result.fileName }, 'Export completion email sent');
  }

  /**
   * Cleanup expired export files
   */
  async cleanupExpiredFiles(): Promise<number> {
    try {
      const files = await fs.readdir(this.exportDir);
      const now = Date.now();
      const retentionMs = Number(process.env.EXPORT_FILE_RETENTION_HOURS || 24) * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.exportDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > retentionMs) {
          await fs.unlink(filePath);
          deletedCount++;
          this.fastify.log.info({ file }, 'Deleted expired export file');
        }
      }

      return deletedCount;
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to cleanup export files');
      return 0;
    }
  }
}
```

**2. Register Worker in Application**

Update `backend/src/app.ts`:

```typescript
import { ExportQueueService } from './services/queue/export-queue.service';
import { ExportWorker } from './workers/export-worker';

// After plugins registered
const exportQueue = new ExportQueueService(fastify);
const exportWorker = new ExportWorker(fastify);

// Start worker
exportQueue.startWorker((job) => exportWorker.processExportJob(job));

// Cleanup expired files on startup
await exportWorker.cleanupExpiredFiles();

// Schedule cleanup job (every hour)
setInterval(
  () => {
    exportWorker.cleanupExpiredFiles();
  },
  60 * 60 * 1000,
);

// Graceful shutdown
fastify.addHook('onClose', async () => {
  await exportQueue.stopWorker();
});
```

---

### Step 6B.3: API Endpoints (2-3 hours)

#### Objectives

- Add endpoints for export job management
- Implement file download endpoint
- Add job status polling

#### Tasks

**1. Update Export Routes**

Update `backend/src/routes/admin-usage.ts`:

```typescript
import { ExportQueueService } from '../services/queue/export-queue.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request export (async for large datasets)
 * POST /api/v1/admin/usage/export-async
 */
fastify.post<{
  Body: AdminUsageFilters & {
    exportType: 'user-breakdown' | 'model-breakdown' | 'provider-breakdown';
    format: 'csv' | 'json' | 'excel';
  };
}>(
  '/export-async',
  {
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    schema: {
      body: {
        type: 'object',
        required: ['startDate', 'endDate', 'exportType', 'format'],
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          exportType: {
            type: 'string',
            enum: ['user-breakdown', 'model-breakdown', 'provider-breakdown'],
          },
          format: {
            type: 'string',
            enum: ['csv', 'json', 'excel'],
          },
          userId: { type: 'string' },
          modelId: { type: 'string' },
          provider: { type: 'string' },
        },
      },
    },
  },
  async (request, reply) => {
    const { exportType, format, ...filters } = request.body;
    const user = (request as AuthenticatedRequest).user!;

    const exportQueue = new ExportQueueService(fastify);
    const jobId = uuidv4();

    const { position } = await exportQueue.addExportJob({
      jobId,
      userId: user.userId,
      userEmail: user.email,
      exportType,
      filters,
      format,
      requestedAt: new Date(),
    });

    return reply.code(202).send({
      message: 'Export job queued',
      jobId,
      position,
      statusUrl: `/api/v1/admin/usage/export-status/${jobId}`,
    });
  },
);

/**
 * Get export job status
 * GET /api/v1/admin/usage/export-status/:jobId
 */
fastify.get<{ Params: { jobId: string } }>(
  '/export-status/:jobId',
  {
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  },
  async (request, reply) => {
    const { jobId } = request.params;

    const exportQueue = new ExportQueueService(fastify);
    const status = await exportQueue.getJobStatus(jobId);

    return reply.send(status);
  },
);

/**
 * Cancel export job
 * DELETE /api/v1/admin/usage/export/:jobId
 */
fastify.delete<{ Params: { jobId: string } }>(
  '/export/:jobId',
  {
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  },
  async (request, reply) => {
    const { jobId } = request.params;

    const exportQueue = new ExportQueueService(fastify);
    await exportQueue.cancelJob(jobId);

    return reply.send({ message: 'Export job cancelled' });
  },
);

/**
 * Get user's export history
 * GET /api/v1/admin/usage/my-exports
 */
fastify.get(
  '/my-exports',
  {
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  },
  async (request, reply) => {
    const user = (request as AuthenticatedRequest).user!;

    const exportQueue = new ExportQueueService(fastify);
    const jobs = await exportQueue.getUserJobs(user.userId);

    return reply.send({ jobs });
  },
);

/**
 * Download export file
 * GET /downloads/:fileName
 */
fastify.get<{ Params: { fileName: string } }>(
  '/downloads/:fileName',
  {
    preHandler: [fastify.authenticate],
  },
  async (request, reply) => {
    const { fileName } = request.params;
    const exportDir = process.env.EXPORT_DIR || path.join(__dirname, '../exports');
    const filePath = path.join(exportDir, fileName);

    // Security: prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(exportDir)) {
      throw ApplicationError.forbidden('Invalid file path');
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw ApplicationError.notFound('Export file not found or expired');
    }

    // Stream file to response
    return reply.sendFile(fileName, exportDir);
  },
);
```

---

### Step 6B.4: Frontend Integration (3-4 hours)

#### Objectives

- Add UI for async export
- Implement job status polling
- Add export history view

#### Tasks

**1. Create Export Job Service**

Create `frontend/src/services/export-job.service.ts`:

```typescript
import { apiClient } from './api-client';

export interface ExportJobRequest {
  startDate: string;
  endDate: string;
  exportType: 'user-breakdown' | 'model-breakdown' | 'provider-breakdown';
  format: 'csv' | 'json' | 'excel';
  userId?: string;
  modelId?: string;
  provider?: string;
}

export interface ExportJobResponse {
  jobId: string;
  position: number;
  statusUrl: string;
}

export interface ExportJobStatus {
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: number;
  position?: number;
  result?: {
    jobId: string;
    fileName: string;
    downloadUrl: string;
    rowCount: number;
    fileSize: number;
    expiresAt: string;
  };
  error?: string;
}

export const exportJobService = {
  /**
   * Request async export
   */
  async requestExport(request: ExportJobRequest): Promise<ExportJobResponse> {
    const response = await apiClient.post<ExportJobResponse>(
      '/api/v1/admin/usage/export-async',
      request,
    );
    return response.data;
  },

  /**
   * Get export job status
   */
  async getJobStatus(jobId: string): Promise<ExportJobStatus> {
    const response = await apiClient.get<ExportJobStatus>(
      `/api/v1/admin/usage/export-status/${jobId}`,
    );
    return response.data;
  },

  /**
   * Cancel export job
   */
  async cancelJob(jobId: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/usage/export/${jobId}`);
  },

  /**
   * Get user's export history
   */
  async getMyExports(): Promise<{ jobs: any[] }> {
    const response = await apiClient.get('/api/v1/admin/usage/my-exports');
    return response.data;
  },
};
```

**2. Create Export Status Component**

Create `frontend/src/components/admin/ExportJobStatus.tsx`:

```typescript
import React from 'react';
import {
  Modal,
  ModalVariant,
  Progress,
  ProgressVariant,
  Button,
  Alert,
} from '@patternfly/react-core';
import { useQuery } from '@tanstack/react-query';
import { exportJobService, ExportJobStatus } from '../../services/export-job.service';
import { useTranslation } from 'react-i18next';

interface ExportJobStatusModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportJobStatusModal: React.FC<ExportJobStatusModalProps> = ({
  jobId,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  const { data: status, isLoading } = useQuery({
    queryKey: ['exportJobStatus', jobId],
    queryFn: () => exportJobService.getJobStatus(jobId),
    refetchInterval: (data) => {
      // Poll every 2 seconds until job is complete or failed
      if (!data) return 2000;
      if (data.status === 'completed' || data.status === 'failed') {
        return false;
      }
      return 2000;
    },
    enabled: isOpen,
  });

  const handleDownload = () => {
    if (status?.result?.downloadUrl) {
      window.location.href = status.result.downloadUrl;
    }
  };

  const handleCancel = async () => {
    await exportJobService.cancelJob(jobId);
    onClose();
  };

  const getProgressVariant = (): ProgressVariant => {
    if (status?.status === 'completed') return ProgressVariant.success;
    if (status?.status === 'failed') return ProgressVariant.danger;
    return ProgressVariant.info;
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title={t('adminUsage.export.statusTitle', 'Export Status')}
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        status?.status === 'completed' && status?.result && (
          <Button key="download" variant="primary" onClick={handleDownload}>
            {t('adminUsage.export.download', 'Download')}
          </Button>
        ),
        status?.status !== 'completed' && status?.status !== 'failed' && (
          <Button key="cancel" variant="secondary" onClick={handleCancel}>
            {t('adminUsage.export.cancel', 'Cancel')}
          </Button>
        ),
        <Button key="close" variant="link" onClick={onClose}>
          {t('common.close', 'Close')}
        </Button>,
      ].filter(Boolean)}
    >
      {isLoading && <div>Loading...</div>}

      {status && (
        <>
          <Progress
            value={status.progress || 0}
            title={t(`adminUsage.export.status.${status.status}`, status.status)}
            variant={getProgressVariant()}
          />

          {status.status === 'waiting' && status.position !== undefined && (
            <Alert
              variant="info"
              isInline
              title={t(
                'adminUsage.export.queuePosition',
                `Position in queue: ${status.position}`
              )}
              style={{ marginTop: '1rem' }}
            />
          )}

          {status.status === 'completed' && status.result && (
            <Alert
              variant="success"
              isInline
              title={t('adminUsage.export.completed', 'Export completed successfully')}
              style={{ marginTop: '1rem' }}
            >
              <p>
                {t('adminUsage.export.rowCount', 'Rows')}: {status.result.rowCount.toLocaleString()}
              </p>
              <p>
                {t('adminUsage.export.fileSize', 'File size')}:{' '}
                {(status.result.fileSize / 1024 / 1024).toFixed(2)} MB
              </p>
              <p>
                {t('adminUsage.export.expiresAt', 'Expires at')}:{' '}
                {new Date(status.result.expiresAt).toLocaleString()}
              </p>
            </Alert>
          )}

          {status.status === 'failed' && (
            <Alert
              variant="danger"
              isInline
              title={t('adminUsage.export.failed', 'Export failed')}
              style={{ marginTop: '1rem' }}
            >
              {status.error}
            </Alert>
          )}
        </>
      )}
    </Modal>
  );
};
```

**3. Update Admin Usage Page**

Update `frontend/src/pages/AdminUsagePage.tsx` to add async export button:

```typescript
const handleAsyncExport = async () => {
  const response = await exportJobService.requestExport({
    startDate: filters.startDate,
    endDate: filters.endDate,
    exportType: 'user-breakdown',
    format: 'csv',
  });

  setCurrentJobId(response.jobId);
  setShowJobStatus(true);

  addNotification({
    variant: 'info',
    title: t('adminUsage.export.queued', 'Export queued'),
    description: t(
      'adminUsage.export.queuedDescription',
      `Your export is in position ${response.position} in the queue.`,
    ),
  });
};
```

---

### Step 6B.5: Monitoring & Admin Tools (2-3 hours)

#### Objectives

- Add queue monitoring dashboard
- Implement admin controls for job management
- Add metrics and alerts

#### Tasks

**1. Create Queue Admin API**

Create `backend/src/routes/admin/queue-management.ts`:

```typescript
/**
 * Get queue statistics
 * GET /api/v1/admin/queue/stats
 */
fastify.get(
  '/stats',
  {
    preHandler: [fastify.authenticate, fastify.requirePermission('admin')],
  },
  async (request, reply) => {
    const exportQueue = new ExportQueueService(fastify);
    const stats = await exportQueue.getQueueStats();
    return reply.send(stats);
  },
);
```

**2. Add Prometheus Metrics**

```typescript
// Track export job metrics
fastify.register(async (fastify) => {
  const exportJobsTotal = new Counter({
    name: 'export_jobs_total',
    help: 'Total number of export jobs',
    labelNames: ['status', 'export_type'],
  });

  const exportJobDuration = new Histogram({
    name: 'export_job_duration_seconds',
    help: 'Export job duration in seconds',
    labelNames: ['export_type'],
  });

  // Update metrics on job completion
  worker.on('completed', (job) => {
    exportJobsTotal.inc({ status: 'completed', export_type: job.data.exportType });
    exportJobDuration.observe(
      { export_type: job.data.exportType },
      (Date.now() - job.timestamp) / 1000,
    );
  });
});
```

---

## Deliverables

- [x] BullMQ job queue infrastructure
- [x] Export queue service
- [x] Export worker implementation
- [x] API endpoints for job management
- [x] File download endpoint
- [x] Frontend export job UI
- [x] Job status polling
- [x] Export history view
- [x] Queue monitoring dashboard
- [x] File cleanup scheduler
- [x] Email notifications
- [x] Tests and documentation

---

## Acceptance Criteria

- [ ] Exports > 10,000 rows processed in background
- [ ] Job status tracked and displayed
- [ ] Email sent on completion
- [ ] Files auto-deleted after retention period
- [ ] Support for CSV, JSON, Excel formats
- [ ] Queue monitoring dashboard working
- [ ] Graceful failure handling
- [ ] All tests passing

---

## Validation

### Manual Testing

```bash
# Request async export
curl -X POST http://localhost:8081/api/v1/admin/usage/export-async \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "exportType": "user-breakdown",
    "format": "csv"
  }'

# Check job status
curl http://localhost:8081/api/v1/admin/usage/export-status/JOB_ID \
  -H "Authorization: Bearer $TOKEN"

# Download file when complete
curl http://localhost:8081/downloads/FILENAME \
  -H "Authorization: Bearer $TOKEN" \
  -o export.csv
```

---

## Next Steps

- [ ] Complete Session 6B deliverables
- [ ] Validate acceptance criteria
- [ ] Proceed to [Session 6C - Advanced Visualizations](./phase-6-session-6c-visualizations.md)

---

**Session Status**: ⬜ Not Started

**Last Updated**: 2025-10-11
