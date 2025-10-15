# Phase 6, Session 6D: Scheduled Reports

**Phase**: 6 - Advanced Features (Optional)
**Session**: 6D
**Duration**: 8-16 hours
**Priority**: 🟢 LOW
**Note**: Optional enhancement for future iterations - Final session of Phase 6

---

## Navigation

- **Previous Session**: [Session 6C - Advanced Visualizations](./phase-6-session-6c-visualizations.md)
- **Current Phase**: [Phase 6 - Advanced Features](../admin-analytics-remediation-plan.md#phase-6-advanced-features-optional)
- **Next Phase**: Phase 6 Complete - All optional enhancements finished
- **Plan Overview**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

This session is the **final session of Phase 6**, which focuses on **optional advanced features** for future enhancement of the Admin Usage Analytics system. Phase 6 is **not required for production deployment** and should only be pursued after Phases 1-5 are complete and stable.

### Phase 6 Summary

Phase 6 addresses advanced features that enhance performance, scalability, and user experience beyond the core requirements:

- **Session 6A**: Redis Caching - High-performance distributed caching
- **Session 6B**: Async Export Queue - Background job processing for large exports
- **Session 6C**: Advanced Visualizations - Enhanced charts and analytics
- **Session 6D** (this session): Scheduled Reports - Automated report generation

**Total Phase 6 Duration**: 40-60 hours

---

## Session Objectives

Implement automated report generation and scheduling system to:

1. **Enable scheduled report generation** (daily, weekly, monthly)
2. **Support multiple report formats** (PDF, Excel, email-embedded)
3. **Implement report distribution** via email and webhook
4. **Add report templates** with customizable content
5. **Create report history** and archive management
6. **Implement report subscriptions** for stakeholders
7. **Add report preview** before scheduling

**Success Criteria**:

- Reports can be scheduled with cron-like syntax
- PDF and Excel report generation working
- Email delivery functional
- Template system flexible and extensible
- Report history maintained for 90 days
- Subscription management UI implemented
- All reports accessible (WCAG 2.1 AA)

---

## Implementation Steps

### Step 6D.1: Report Scheduling Infrastructure (2-3 hours)

#### Objectives

- Set up scheduled job system (building on Session 6B queue)
- Create report scheduling configuration
- Implement cron-based scheduling

#### Tasks

**1. Extend Job Queue for Scheduled Reports**

Update `backend/src/config/job-queue.config.ts`:

```typescript
export const QUEUE_NAMES = {
  EXPORT: 'export-jobs',
  SCHEDULED_REPORT: 'scheduled-report-jobs', // New
} as const;
```

**2. Create Report Scheduler Service**

Create `backend/src/services/queue/report-scheduler.service.ts`:

```typescript
import { Queue, Worker, Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { getJobQueueConfig, QUEUE_NAMES } from '../../config/job-queue.config';
import { ApplicationError } from '../../utils/errors';

export interface ScheduledReportConfig {
  id: string;
  name: string;
  description?: string;
  userId: string; // Owner of the report
  schedule: string; // Cron expression
  reportType: 'usage-summary' | 'cost-analysis' | 'user-activity' | 'model-performance';
  format: 'pdf' | 'excel' | 'html';
  deliveryMethod: 'email' | 'webhook' | 'both';
  recipients: string[]; // Email addresses
  webhookUrl?: string;
  filters: Partial<AdminUsageFilters>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledReportJobData {
  reportConfigId: string;
  reportConfig: ScheduledReportConfig;
  runDate: Date;
}

export interface ScheduledReportJobResult {
  reportId: string;
  reportConfigId: string;
  generatedAt: Date;
  format: string;
  filePath?: string;
  emailsSent?: number;
  webhookDelivered?: boolean;
  error?: string;
}

export class ReportSchedulerService extends BaseService {
  private queue: Queue<ScheduledReportJobData, ScheduledReportJobResult>;
  private worker: Worker<ScheduledReportJobData, ScheduledReportJobResult> | null = null;

  constructor(fastify: FastifyInstance) {
    super(fastify);

    const config = getJobQueueConfig();

    this.queue = new Queue<ScheduledReportJobData, ScheduledReportJobResult>(
      QUEUE_NAMES.SCHEDULED_REPORT,
      {
        connection: config.redis,
        defaultJobOptions: {
          ...config.defaultJobOptions,
          repeat: undefined, // Will be set per job
        },
      },
    );
  }

  /**
   * Create a new scheduled report
   */
  async createScheduledReport(
    config: Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScheduledReportConfig> {
    try {
      // Validate cron expression
      this.validateCronExpression(config.schedule);

      const reportConfig: ScheduledReportConfig = {
        ...config,
        id: this.generateReportId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store config in database
      await this.saveReportConfig(reportConfig);

      // Schedule job if enabled
      if (reportConfig.enabled) {
        await this.scheduleReportJob(reportConfig);
      }

      this.fastify.log.info(
        {
          reportId: reportConfig.id,
          schedule: reportConfig.schedule,
        },
        'Scheduled report created',
      );

      return reportConfig;
    } catch (error) {
      this.fastify.log.error({ error, config }, 'Failed to create scheduled report');
      throw ApplicationError.internal('Failed to create scheduled report', { error });
    }
  }

  /**
   * Update scheduled report configuration
   */
  async updateScheduledReport(
    reportId: string,
    updates: Partial<ScheduledReportConfig>,
  ): Promise<ScheduledReportConfig> {
    try {
      const existing = await this.getReportConfig(reportId);

      if (!existing) {
        throw ApplicationError.notFound('Scheduled report not found');
      }

      // Validate cron if changed
      if (updates.schedule) {
        this.validateCronExpression(updates.schedule);
      }

      const updated: ScheduledReportConfig = {
        ...existing,
        ...updates,
        id: reportId, // Ensure ID doesn't change
        updatedAt: new Date(),
      };

      // Update database
      await this.saveReportConfig(updated);

      // Reschedule job
      await this.removeScheduledJob(reportId);
      if (updated.enabled) {
        await this.scheduleReportJob(updated);
      }

      this.fastify.log.info({ reportId }, 'Scheduled report updated');

      return updated;
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      this.fastify.log.error({ error, reportId }, 'Failed to update scheduled report');
      throw ApplicationError.internal('Failed to update scheduled report', { error });
    }
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(reportId: string): Promise<void> {
    try {
      // Remove from scheduler
      await this.removeScheduledJob(reportId);

      // Delete from database
      await this.deleteReportConfig(reportId);

      this.fastify.log.info({ reportId }, 'Scheduled report deleted');
    } catch (error) {
      this.fastify.log.error({ error, reportId }, 'Failed to delete scheduled report');
      throw ApplicationError.internal('Failed to delete scheduled report', { error });
    }
  }

  /**
   * Get all scheduled reports for a user
   */
  async getUserScheduledReports(userId: string): Promise<ScheduledReportConfig[]> {
    try {
      return await this.fastify.pg
        .query<ScheduledReportConfig>(
          'SELECT * FROM scheduled_reports WHERE user_id = $1 ORDER BY created_at DESC',
          [userId],
        )
        .then((result) => result.rows);
    } catch (error) {
      this.fastify.log.error({ error, userId }, 'Failed to get user scheduled reports');
      throw ApplicationError.internal('Failed to get scheduled reports', { error });
    }
  }

  /**
   * Schedule report job with cron
   */
  private async scheduleReportJob(config: ScheduledReportConfig): Promise<void> {
    await this.queue.add(
      'scheduled-report',
      {
        reportConfigId: config.id,
        reportConfig: config,
        runDate: new Date(),
      },
      {
        jobId: `scheduled-report-${config.id}`,
        repeat: {
          pattern: config.schedule,
        },
      },
    );
  }

  /**
   * Remove scheduled job
   */
  private async removeScheduledJob(reportId: string): Promise<void> {
    const jobId = `scheduled-report-${reportId}`;
    await this.queue.remove(jobId);

    // Also remove repeatable job
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const job = repeatableJobs.find((j) => j.id === jobId);
    if (job) {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }

  /**
   * Validate cron expression
   */
  private validateCronExpression(cron: string): void {
    // Basic validation - in production, use a library like cron-parser
    const parts = cron.split(' ');
    if (parts.length < 5 || parts.length > 6) {
      throw ApplicationError.badRequest('Invalid cron expression');
    }
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save report configuration to database
   */
  private async saveReportConfig(config: ScheduledReportConfig): Promise<void> {
    await this.fastify.pg.query(
      `INSERT INTO scheduled_reports (
        id, name, description, user_id, schedule, report_type, format,
        delivery_method, recipients, webhook_url, filters, enabled,
        last_run, next_run, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        name = $2, description = $3, schedule = $5, report_type = $6,
        format = $7, delivery_method = $8, recipients = $9, webhook_url = $10,
        filters = $11, enabled = $12, updated_at = $16`,
      [
        config.id,
        config.name,
        config.description,
        config.userId,
        config.schedule,
        config.reportType,
        config.format,
        config.deliveryMethod,
        JSON.stringify(config.recipients),
        config.webhookUrl,
        JSON.stringify(config.filters),
        config.enabled,
        config.lastRun,
        config.nextRun,
        config.createdAt,
        config.updatedAt,
      ],
    );
  }

  /**
   * Get report configuration from database
   */
  private async getReportConfig(reportId: string): Promise<ScheduledReportConfig | null> {
    const result = await this.fastify.pg.query('SELECT * FROM scheduled_reports WHERE id = $1', [
      reportId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      recipients: JSON.parse(row.recipients),
      filters: JSON.parse(row.filters),
    };
  }

  /**
   * Delete report configuration from database
   */
  private async deleteReportConfig(reportId: string): Promise<void> {
    await this.fastify.pg.query('DELETE FROM scheduled_reports WHERE id = $1', [reportId]);
  }

  /**
   * Start worker to process scheduled report jobs
   */
  startWorker(
    processor: (job: Job<ScheduledReportJobData>) => Promise<ScheduledReportJobResult>,
  ): void {
    const config = getJobQueueConfig();

    this.worker = new Worker<ScheduledReportJobData, ScheduledReportJobResult>(
      QUEUE_NAMES.SCHEDULED_REPORT,
      processor,
      {
        connection: config.redis,
        concurrency: 2, // Limit concurrent report generation
      },
    );

    this.worker.on('completed', (job) => {
      this.fastify.log.info(
        {
          reportConfigId: job.data.reportConfigId,
          reportId: job.returnvalue?.reportId,
        },
        'Scheduled report completed',
      );

      // Update lastRun timestamp
      this.updateLastRun(job.data.reportConfigId, new Date());
    });

    this.worker.on('failed', (job, error) => {
      this.fastify.log.error(
        {
          reportConfigId: job?.data.reportConfigId,
          error,
        },
        'Scheduled report failed',
      );
    });

    this.fastify.log.info('Report scheduler worker started');
  }

  /**
   * Stop worker
   */
  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      this.fastify.log.info('Report scheduler worker stopped');
    }
  }

  /**
   * Update last run timestamp
   */
  private async updateLastRun(reportId: string, lastRun: Date): Promise<void> {
    await this.fastify.pg.query('UPDATE scheduled_reports SET last_run = $1 WHERE id = $2', [
      lastRun,
      reportId,
    ]);
  }
}
```

---

### Step 6D.2: Report Generation Engine (3-4 hours)

#### Objectives

- Implement report templates
- Add PDF generation
- Add Excel generation
- Implement HTML email templates

#### Tasks

**1. Install Report Generation Dependencies**

```bash
npm --prefix backend install pdfkit exceljs handlebars
npm --prefix backend install --save-dev @types/pdfkit
```

**2. Create Report Generator Service**

Create `backend/src/services/report-generator.service.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseService } from './base.service';
import { ScheduledReportConfig } from './queue/report-scheduler.service';

export interface ReportData {
  title: string;
  period: { start: string; end: string };
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    uniqueUsers: number;
    uniqueModels: number;
  };
  trends: {
    requestsChange: number;
    tokensChange: number;
    costChange: number;
  };
  topUsers: Array<{
    username: string;
    requests: number;
    cost: number;
  }>;
  topModels: Array<{
    modelId: string;
    requests: number;
    cost: number;
  }>;
  charts?: {
    usageTrend?: string; // Base64 encoded chart image
    modelDistribution?: string;
  };
}

export class ReportGeneratorService extends BaseService {
  private templatesDir: string;

  constructor(fastify: FastifyInstance) {
    super(fastify);
    this.templatesDir = path.join(__dirname, '../templates/reports');
  }

  /**
   * Generate report in specified format
   */
  async generateReport(
    config: ScheduledReportConfig,
    data: ReportData,
  ): Promise<{ filePath: string; fileName: string }> {
    switch (config.format) {
      case 'pdf':
        return this.generatePDFReport(config, data);
      case 'excel':
        return this.generateExcelReport(config, data);
      case 'html':
        return this.generateHTMLReport(config, data);
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(
    config: ScheduledReportConfig,
    data: ReportData,
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${config.name.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const filePath = path.join(process.env.REPORTS_DIR || '/tmp/reports', fileName);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const doc = new PDFDocument({ margin: 50 });
    const stream = doc.pipe(require('fs').createWriteStream(filePath));

    // Header
    doc.fontSize(24).text(data.title, { align: 'center' }).moveDown();

    doc
      .fontSize(12)
      .text(`Period: ${data.period.start} to ${data.period.end}`, { align: 'center' })
      .moveDown(2);

    // Summary Section
    doc.fontSize(16).text('Summary', { underline: true }).moveDown();

    doc.fontSize(12);
    doc.text(`Total Requests: ${data.summary.totalRequests.toLocaleString()}`);
    doc.text(`Total Tokens: ${data.summary.totalTokens.toLocaleString()}`);
    doc.text(`Total Cost: $${data.summary.totalCost.toFixed(2)}`);
    doc.text(`Unique Users: ${data.summary.uniqueUsers}`);
    doc.text(`Unique Models: ${data.summary.uniqueModels}`);
    doc.moveDown(2);

    // Trends Section
    doc.fontSize(16).text('Trends', { underline: true }).moveDown();

    doc.fontSize(12);
    doc.text(
      `Requests: ${data.trends.requestsChange > 0 ? '+' : ''}${data.trends.requestsChange.toFixed(1)}%`,
    );
    doc.text(
      `Tokens: ${data.trends.tokensChange > 0 ? '+' : ''}${data.trends.tokensChange.toFixed(1)}%`,
    );
    doc.text(`Cost: ${data.trends.costChange > 0 ? '+' : ''}${data.trends.costChange.toFixed(1)}%`);
    doc.moveDown(2);

    // Top Users Section
    doc.fontSize(16).text('Top Users', { underline: true }).moveDown();

    doc.fontSize(10);
    data.topUsers.slice(0, 10).forEach((user, index) => {
      doc.text(
        `${index + 1}. ${user.username} - ${user.requests.toLocaleString()} requests ($${user.cost.toFixed(2)})`,
      );
    });
    doc.moveDown(2);

    // Top Models Section
    doc.fontSize(16).text('Top Models', { underline: true }).moveDown();

    doc.fontSize(10);
    data.topModels.slice(0, 10).forEach((model, index) => {
      doc.text(
        `${index + 1}. ${model.modelId} - ${model.requests.toLocaleString()} requests ($${model.cost.toFixed(2)})`,
      );
    });

    // Footer
    doc.fontSize(8).text(`Generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 50, {
      align: 'center',
    });

    // Finalize PDF
    doc.end();

    // Wait for stream to finish
    await new Promise((resolve) => stream.on('finish', resolve));

    return { filePath, fileName };
  }

  /**
   * Generate Excel report
   */
  private async generateExcelReport(
    config: ScheduledReportConfig,
    data: ReportData,
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${config.name.replace(/\s+/g, '-')}-${Date.now()}.xlsx`;
    const filePath = path.join(process.env.REPORTS_DIR || '/tmp/reports', fileName);

    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');

    summarySheet.addRow(['Report', data.title]);
    summarySheet.addRow(['Period', `${data.period.start} to ${data.period.end}`]);
    summarySheet.addRow([]);

    summarySheet.addRow(['Metric', 'Value', 'Change']);
    summarySheet.addRow([
      'Total Requests',
      data.summary.totalRequests,
      `${data.trends.requestsChange.toFixed(1)}%`,
    ]);
    summarySheet.addRow([
      'Total Tokens',
      data.summary.totalTokens,
      `${data.trends.tokensChange.toFixed(1)}%`,
    ]);
    summarySheet.addRow([
      'Total Cost',
      `$${data.summary.totalCost.toFixed(2)}`,
      `${data.trends.costChange.toFixed(1)}%`,
    ]);
    summarySheet.addRow(['Unique Users', data.summary.uniqueUsers, '']);
    summarySheet.addRow(['Unique Models', data.summary.uniqueModels, '']);

    // Style header row
    summarySheet.getRow(4).font = { bold: true };
    summarySheet.columns = [{ width: 20 }, { width: 20 }, { width: 15 }];

    // Top Users Sheet
    const usersSheet = workbook.addWorksheet('Top Users');
    usersSheet.addRow(['Rank', 'Username', 'Requests', 'Cost']);

    data.topUsers.forEach((user, index) => {
      usersSheet.addRow([index + 1, user.username, user.requests, `$${user.cost.toFixed(2)}`]);
    });

    usersSheet.getRow(1).font = { bold: true };

    // Top Models Sheet
    const modelsSheet = workbook.addWorksheet('Top Models');
    modelsSheet.addRow(['Rank', 'Model', 'Requests', 'Cost']);

    data.topModels.forEach((model, index) => {
      modelsSheet.addRow([index + 1, model.modelId, model.requests, `$${model.cost.toFixed(2)}`]);
    });

    modelsSheet.getRow(1).font = { bold: true };

    // Save workbook
    await workbook.xlsx.writeFile(filePath);

    return { filePath, fileName };
  }

  /**
   * Generate HTML report (for email)
   */
  private async generateHTMLReport(
    config: ScheduledReportConfig,
    data: ReportData,
  ): Promise<{ filePath: string; fileName: string }> {
    const fileName = `${config.name.replace(/\s+/g, '-')}-${Date.now()}.html`;
    const filePath = path.join(process.env.REPORTS_DIR || '/tmp/reports', fileName);

    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Load template
    const templatePath = path.join(this.templatesDir, 'usage-report.hbs');
    const templateSource = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    // Generate HTML
    const html = template(data);

    // Save to file
    await fs.writeFile(filePath, html, 'utf-8');

    return { filePath, fileName };
  }

  /**
   * Fetch report data based on configuration
   */
  async fetchReportData(config: ScheduledReportConfig): Promise<ReportData> {
    const adminUsageService = new AdminUsageStatsService(this.fastify, this.fastify.liteLLM);

    // Determine date range based on report type
    const { startDate, endDate } = this.getDateRangeForReport(config);

    const filters: AdminUsageFilters = {
      startDate,
      endDate,
      ...config.filters,
    };

    // Fetch analytics data
    const analytics = await adminUsageService.getAnalytics(filters);
    const userBreakdown = await adminUsageService.getUserBreakdown(filters);
    const modelBreakdown = await adminUsageService.getModelBreakdown(filters);

    // Format data for report
    return {
      title: config.name,
      period: { start: startDate, end: endDate },
      summary: {
        totalRequests: analytics.metrics.totalRequests,
        totalTokens: analytics.metrics.totalTokens,
        totalCost: analytics.metrics.totalCost,
        uniqueUsers: userBreakdown.length,
        uniqueModels: modelBreakdown.length,
      },
      trends: {
        requestsChange: analytics.trends.requestsTrend.percentageChange,
        tokensChange: analytics.trends.tokensTrend.percentageChange,
        costChange: analytics.trends.costTrend.percentageChange,
      },
      topUsers: userBreakdown
        .sort((a, b) => b.totalRequests - a.totalRequests)
        .slice(0, 10)
        .map((u) => ({
          username: u.username,
          requests: u.totalRequests,
          cost: u.totalCost,
        })),
      topModels: modelBreakdown
        .sort((a, b) => b.totalRequests - a.totalRequests)
        .slice(0, 10)
        .map((m) => ({
          modelId: m.modelId,
          requests: m.totalRequests,
          cost: m.totalCost,
        })),
    };
  }

  /**
   * Get date range for report based on type
   */
  private getDateRangeForReport(config: ScheduledReportConfig): {
    startDate: string;
    endDate: string;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (config.reportType) {
      case 'usage-summary':
        // Previous day
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        break;

      case 'cost-analysis':
        // Previous week
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;

      case 'user-activity':
        // Previous month
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        break;

      case 'model-performance':
        // Previous week
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;

      default:
        // Default to previous day
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }
}
```

---

### Step 6D.3: Report Delivery (2-3 hours)

#### Objectives

- Implement email delivery
- Add webhook delivery
- Create delivery tracking

#### Tasks

**1. Create Report Delivery Service**

Create `backend/src/services/report-delivery.service.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';
import { ScheduledReportConfig } from './queue/report-scheduler.service';
import * as fs from 'fs/promises';
import axios from 'axios';

export class ReportDeliveryService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  /**
   * Deliver report via configured methods
   */
  async deliverReport(
    config: ScheduledReportConfig,
    filePath: string,
    fileName: string,
  ): Promise<{
    emailsSent: number;
    webhookDelivered: boolean;
  }> {
    let emailsSent = 0;
    let webhookDelivered = false;

    if (config.deliveryMethod === 'email' || config.deliveryMethod === 'both') {
      emailsSent = await this.deliverViaEmail(config, filePath, fileName);
    }

    if (config.deliveryMethod === 'webhook' || config.deliveryMethod === 'both') {
      webhookDelivered = await this.deliverViaWebhook(config, filePath, fileName);
    }

    return { emailsSent, webhookDelivered };
  }

  /**
   * Deliver report via email
   */
  private async deliverViaEmail(
    config: ScheduledReportConfig,
    filePath: string,
    fileName: string,
  ): Promise<number> {
    try {
      const fileContent = await fs.readFile(filePath);

      for (const recipient of config.recipients) {
        await this.fastify.mail.send({
          to: recipient,
          subject: `Scheduled Report: ${config.name}`,
          text: `Please find attached your scheduled report: ${config.name}`,
          html: `
            <h2>Scheduled Report: ${config.name}</h2>
            <p>Please find attached your scheduled report.</p>
            <p><strong>Report Type:</strong> ${config.reportType}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          `,
          attachments: [
            {
              filename: fileName,
              content: fileContent,
            },
          ],
        });

        this.fastify.log.info({ recipient, reportId: config.id }, 'Report email sent');
      }

      return config.recipients.length;
    } catch (error) {
      this.fastify.log.error({ error, reportId: config.id }, 'Failed to send report email');
      throw error;
    }
  }

  /**
   * Deliver report via webhook
   */
  private async deliverViaWebhook(
    config: ScheduledReportConfig,
    filePath: string,
    fileName: string,
  ): Promise<boolean> {
    if (!config.webhookUrl) {
      return false;
    }

    try {
      const fileContent = await fs.readFile(filePath);
      const base64Content = fileContent.toString('base64');

      await axios.post(
        config.webhookUrl,
        {
          reportId: config.id,
          reportName: config.name,
          reportType: config.reportType,
          format: config.format,
          fileName,
          content: base64Content,
          generatedAt: new Date().toISOString(),
        },
        {
          timeout: 10000,
        },
      );

      this.fastify.log.info(
        { webhookUrl: config.webhookUrl, reportId: config.id },
        'Report webhook delivered',
      );

      return true;
    } catch (error) {
      this.fastify.log.error(
        { error, webhookUrl: config.webhookUrl, reportId: config.id },
        'Failed to deliver report via webhook',
      );
      return false;
    }
  }
}
```

---

### Step 6D.4: API Endpoints (2-3 hours)

#### Objectives

- Add CRUD endpoints for scheduled reports
- Implement preview generation
- Add report history endpoints

#### Tasks

**1. Create Scheduled Reports Routes**

Create `backend/src/routes/admin/scheduled-reports.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { ReportSchedulerService } from '../../services/queue/report-scheduler.service';
import { ReportGeneratorService } from '../../services/report-generator.service';

const scheduledReportsRoutes: FastifyPluginAsync = async (fastify) => {
  const reportScheduler = new ReportSchedulerService(fastify);
  const reportGenerator = new ReportGeneratorService(fastify);

  /**
   * Create scheduled report
   * POST /api/v1/admin/scheduled-reports
   */
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const user = (request as AuthenticatedRequest).user!;
      const config = request.body as any;

      const scheduledReport = await reportScheduler.createScheduledReport({
        ...config,
        userId: user.userId,
      });

      return reply.code(201).send(scheduledReport);
    },
  );

  /**
   * Get user's scheduled reports
   * GET /api/v1/admin/scheduled-reports
   */
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const user = (request as AuthenticatedRequest).user!;
      const reports = await reportScheduler.getUserScheduledReports(user.userId);
      return reply.send({ reports });
    },
  );

  /**
   * Update scheduled report
   * PUT /api/v1/admin/scheduled-reports/:id
   */
  fastify.put<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body as any;

      const updated = await reportScheduler.updateScheduledReport(id, updates);
      return reply.send(updated);
    },
  );

  /**
   * Delete scheduled report
   * DELETE /api/v1/admin/scheduled-reports/:id
   */
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const { id } = request.params;
      await reportScheduler.deleteScheduledReport(id);
      return reply.send({ message: 'Scheduled report deleted' });
    },
  );

  /**
   * Generate report preview
   * POST /api/v1/admin/scheduled-reports/preview
   */
  fastify.post(
    '/preview',
    {
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const config = request.body as any;
      const data = await reportGenerator.fetchReportData(config);
      return reply.send(data);
    },
  );
};

export default scheduledReportsRoutes;
```

---

### Step 6D.5: Frontend UI (2-4 hours)

#### Objectives

- Create scheduled reports management page
- Add report subscription UI
- Implement report history view

#### Tasks

**1. Create Scheduled Reports Page**

Create `frontend/src/pages/ScheduledReportsPage.tsx`:

```typescript
import React, { useState } from 'react';
import {
  Page,
  PageSection,
  Title,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  Form,
  FormGroup,
  TextInput,
  Select,
  SelectOption,
} from '@patternfly/react-core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export const ScheduledReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: reports } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: () => reportService.getScheduledReports(),
  });

  const createMutation = useMutation({
    mutationFn: reportService.createScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      setIsCreateModalOpen(false);
    },
  });

  return (
    <Page>
      <PageSection>
        <Title headingLevel="h1">
          {t('scheduledReports.title', 'Scheduled Reports')}
        </Title>

        <Button onClick={() => setIsCreateModalOpen(true)}>
          {t('scheduledReports.create', 'Create Scheduled Report')}
        </Button>

        <Table>
          <Thead>
            <Tr>
              <Th>{t('scheduledReports.name', 'Name')}</Th>
              <Th>{t('scheduledReports.schedule', 'Schedule')}</Th>
              <Th>{t('scheduledReports.format', 'Format')}</Th>
              <Th>{t('scheduledReports.status', 'Status')}</Th>
              <Th>{t('scheduledReports.lastRun', 'Last Run')}</Th>
              <Th>{t('scheduledReports.actions', 'Actions')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {reports?.reports.map((report: any) => (
              <Tr key={report.id}>
                <Td>{report.name}</Td>
                <Td>{report.schedule}</Td>
                <Td>{report.format}</Td>
                <Td>{report.enabled ? 'Enabled' : 'Disabled'}</Td>
                <Td>
                  {report.lastRun
                    ? new Date(report.lastRun).toLocaleString()
                    : 'Never'}
                </Td>
                <Td>
                  <Button variant="link">Edit</Button>
                  <Button variant="link">Delete</Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </PageSection>

      {/* Create Modal - Simplified */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Scheduled Report"
      >
        {/* Form fields here */}
      </Modal>
    </Page>
  );
};
```

---

## Deliverables

- [x] Report scheduling infrastructure
- [x] Cron-based job scheduler
- [x] PDF report generation
- [x] Excel report generation
- [x] HTML email templates
- [x] Email delivery system
- [x] Webhook delivery
- [x] CRUD API endpoints
- [x] Scheduled reports UI
- [x] Report history tracking
- [x] Database migration for scheduled_reports table
- [x] Tests and documentation

---

## Acceptance Criteria

- [ ] Reports schedule with cron syntax
- [ ] PDF and Excel generation working
- [ ] Email delivery functional
- [ ] Webhook delivery functional
- [ ] Templates customizable
- [ ] History maintained for 90 days
- [ ] UI functional and accessible
- [ ] All tests passing

---

## Validation

### Manual Testing

1. Create scheduled report via UI
2. Verify job scheduled in queue
3. Wait for execution or trigger manually
4. Verify report generated
5. Check email delivery
6. Verify webhook called
7. Check report history

### Automated Testing

```bash
npm --prefix backend test -- scheduled-reports
```

---

## Phase 6 Checkpoint: Advanced Features Complete

**This is the final session of Phase 6.** Upon completion:

### Phase 6 Summary

**Sessions Completed**:

- ✅ Session 6A: Redis Caching
- ✅ Session 6B: Async Export Queue
- ✅ Session 6C: Advanced Visualizations
- ✅ Session 6D: Scheduled Reports (this session)

**Total Duration**: 40-60 hours

### Final Validation

**Deliverables Check**:

- [ ] All Phase 6 sessions complete
- [ ] Redis caching operational
- [ ] Async exports functional
- [ ] Advanced charts implemented
- [ ] Scheduled reports working
- [ ] All tests passing
- [ ] Documentation complete

### Optional Enhancements Complete

**Phase 6 represents optional enhancements** that are not required for production deployment. These features provide:

- **Performance improvements** (Redis caching)
- **Scalability** (async job processing)
- **Enhanced UX** (advanced visualizations)
- **Automation** (scheduled reports)

**Next Steps After Phase 6**:

1. **If deploying to production**: Focus on Phases 1-5 monitoring
2. **If enhancing further**: Consider:
   - Machine learning for usage anomaly detection
   - Advanced cost forecasting models
   - Multi-tenant report isolation
   - Report audit logging
   - Custom report template designer

---

## Notes

### Design Decisions

**Cron Scheduling**:

- Industry-standard syntax
- Flexible and powerful
- Well-understood by ops teams

**Multiple Formats**:

- PDF for formal reports
- Excel for data analysis
- HTML for email convenience

**Dual Delivery**:

- Email for notifications
- Webhook for integration
- Both for comprehensive coverage

---

**Session Status**: ⬜ Not Started

**Last Updated**: 2025-10-11
