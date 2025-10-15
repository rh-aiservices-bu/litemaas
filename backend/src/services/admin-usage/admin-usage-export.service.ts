// backend/src/services/admin-usage/admin-usage-export.service.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { ApplicationError } from '../../utils/errors';
import type {
  AdminUsageFilters,
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
} from '../../types/admin-usage.types';

/**
 * Service for exporting admin usage analytics data
 *
 * Provides CSV and JSON export functionality for all breakdown types.
 * Handles data formatting, CSV escaping, and metadata inclusion.
 */
export class AdminUsageExportService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // ============================================================================
  // CSV Export Methods
  // ============================================================================

  /**
   * Export user breakdown to CSV format
   *
   * @param breakdown - User breakdown data
   * @param filters - Original filters for metadata
   * @returns CSV string with headers and data
   */
  async exportUserBreakdownToCSV(
    breakdown: UserBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    try {
      const headers = [
        'User ID',
        'Username',
        'Email',
        'Total Requests',
        'Total Tokens',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Cost (USD)',
      ];

      const rows = breakdown.map((user) => [
        user.userId,
        user.username,
        user.email || '',
        user.metrics.requests.toString(),
        user.metrics.tokens.total.toString(),
        user.metrics.tokens.prompt.toString(),
        user.metrics.tokens.completion.toString(),
        user.metrics.cost.toFixed(4),
      ]);

      return this.generateCSV(headers, rows);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export user breakdown to CSV');
      throw ApplicationError.internal('Failed to generate CSV export', { error });
    }
  }

  /**
   * Export model breakdown to CSV format
   *
   * @param breakdown - Model breakdown data
   * @param filters - Original filters for metadata
   * @returns CSV string with headers and data
   */
  async exportModelBreakdownToCSV(
    breakdown: ModelBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    try {
      const headers = [
        'Model',
        'Provider',
        'Total Requests',
        'Total Tokens',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Cost (USD)',
        'Unique Users',
      ];

      const rows = breakdown.map((model) => [
        model.modelName,
        model.provider || '',
        model.metrics.requests.toString(),
        model.metrics.tokens.total.toString(),
        model.metrics.tokens.prompt.toString(),
        model.metrics.tokens.completion.toString(),
        model.metrics.cost.toFixed(4),
        model.metrics.users?.toString() || '0',
      ]);

      return this.generateCSV(headers, rows);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export model breakdown to CSV');
      throw ApplicationError.internal('Failed to generate CSV export', { error });
    }
  }

  /**
   * Export provider breakdown to CSV format
   *
   * @param breakdown - Provider breakdown data
   * @param filters - Original filters for metadata
   * @returns CSV string with headers and data
   */
  async exportProviderBreakdownToCSV(
    breakdown: ProviderBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    try {
      const headers = [
        'Provider',
        'Total Requests',
        'Total Tokens',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Cost (USD)',
        'Unique Users',
        'Unique Models',
      ];

      const rows = breakdown.map((provider) => [
        provider.provider,
        provider.metrics.requests.toString(),
        provider.metrics.tokens.total.toString(),
        provider.metrics.tokens.prompt.toString(),
        provider.metrics.tokens.completion.toString(),
        provider.metrics.cost.toFixed(4),
        provider.metrics.users?.toString() || '0',
        provider.metrics.models?.toString() || '0',
      ]);

      return this.generateCSV(headers, rows);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export provider breakdown to CSV');
      throw ApplicationError.internal('Failed to generate CSV export', { error });
    }
  }

  // ============================================================================
  // JSON Export Methods
  // ============================================================================

  /**
   * Export data to JSON format with metadata
   *
   * @param data - Data to export (any breakdown type)
   * @param filters - Original filters for metadata
   * @param breakdownType - Type of breakdown ('user', 'model', 'provider')
   * @returns JSON string with metadata wrapper
   */
  async exportToJSON<T>(
    data: T,
    filters: AdminUsageFilters,
    breakdownType?: string,
  ): Promise<string> {
    try {
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          breakdownType: breakdownType || 'unknown',
          filters: {
            startDate: filters.startDate,
            endDate: filters.endDate,
            userIds: filters.userIds,
            modelIds: filters.modelIds,
            providerIds: filters.providerIds,
            apiKeyIds: filters.apiKeyIds,
          },
          recordCount: Array.isArray(data) ? data.length : 1,
        },
        data,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export to JSON');
      throw ApplicationError.internal('Failed to generate JSON export', { error });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate CSV string from headers and rows
   *
   * @param headers - Array of header strings
   * @param rows - Array of row arrays
   * @returns CSV string
   */
  private generateCSV(headers: string[], rows: string[][]): string {
    const csvLines = [
      // Header row
      headers.map(this.escapeCSVField).join(','),
      // Data rows
      ...rows.map((row) => row.map(this.escapeCSVField).join(',')),
    ];

    return csvLines.join('\n');
  }

  /**
   * Escape CSV field for safe export
   *
   * Handles commas, newlines, and double quotes according to CSV RFC 4180.
   *
   * @param field - Field value to escape
   * @returns Escaped field value
   */
  private escapeCSVField(field: string): string {
    // If field contains comma, newline, or double quote, wrap in quotes
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
      // Escape double quotes by doubling them
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Generate export filename with timestamp
   *
   * @param breakdownType - Type of breakdown
   * @param format - Export format ('csv' or 'json')
   * @returns Filename with timestamp
   */
  generateExportFilename(breakdownType: string, format: 'csv' | 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `admin-usage-${breakdownType}-${timestamp}.${format}`;
  }

  /**
   * Get MIME type for export format
   *
   * @param format - Export format ('csv' or 'json')
   * @returns MIME type string
   */
  getMimeType(format: 'csv' | 'json'): string {
    return format === 'csv' ? 'text/csv' : 'application/json';
  }
}
