import type { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';
import { getTodayUTC, subDaysUTC } from './admin-usage/admin-usage.utils.js';

interface CachedModelEntry {
  metrics: {
    api_requests: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    spend: number;
    successful_requests: number;
    failed_requests: number;
  };
  users: Record<string, unknown>;
}

interface PopularityCache {
  data: Record<string, number>;
  expiresAt: number;
}

export class ModelPopularityService extends BaseService {
  private cache: PopularityCache | null = null;
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly ROLLING_WINDOW_DAYS = 29;
  private static readonly MAX_STARS = 5;
  private static readonly MIN_STARS = 1;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async getPopularityRatings(): Promise<Record<string, number>> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      this.fastify.log.debug('Model popularity cache hit');
      return this.cache.data;
    }

    const today = getTodayUTC();
    const startDate = subDaysUTC(today, ModelPopularityService.ROLLING_WINDOW_DAYS);

    const modelsResult = await this.executeQuery<{
      rows: Array<{ id: string }>;
    }>(`SELECT id FROM models`, [], 'fetching model IDs');

    const modelIds = modelsResult.rows.map((r) => r.id);
    const modelIdLookup = new Map<string, string>();
    for (const id of modelIds) {
      modelIdLookup.set(id.toLowerCase(), id);
    }

    const result = await this.executeQuery<{
      rows: Array<{ aggregated_by_model: Record<string, CachedModelEntry> | null }>;
    }>(
      `SELECT aggregated_by_model
       FROM daily_usage_cache
       WHERE date BETWEEN $1 AND $2`,
      [startDate, today],
      'fetching model popularity data',
    );

    const requestCounts = this.aggregateRequestCounts(result.rows, modelIdLookup);
    const ratings = this.calculateRatings(requestCounts);

    this.cache = {
      data: ratings,
      expiresAt: Date.now() + ModelPopularityService.CACHE_TTL_MS,
    };

    this.fastify.log.info(
      { modelCount: Object.keys(ratings).length, startDate, endDate: today },
      'Computed model popularity ratings',
    );

    return ratings;
  }

  private resolveModelId(cacheKey: string, modelIdLookup: Map<string, string>): string | null {
    const directMatch = modelIdLookup.get(cacheKey.toLowerCase());
    if (directMatch) return directMatch;

    const slashIndex = cacheKey.indexOf('/');
    if (slashIndex !== -1) {
      const stripped = cacheKey.substring(slashIndex + 1);
      const strippedMatch = modelIdLookup.get(stripped.toLowerCase());
      if (strippedMatch) return strippedMatch;
    }

    return null;
  }

  private aggregateRequestCounts(
    rows: Array<{ aggregated_by_model: Record<string, CachedModelEntry> | null }>,
    modelIdLookup: Map<string, string>,
  ): Map<string, number> {
    const totals = new Map<string, number>();

    for (const row of rows) {
      const byModel = row.aggregated_by_model;
      if (!byModel) continue;

      for (const [cacheKey, entry] of Object.entries(byModel)) {
        const modelId = this.resolveModelId(cacheKey, modelIdLookup);
        if (!modelId) continue;

        const current = totals.get(modelId) || 0;
        totals.set(modelId, current + (entry.metrics?.api_requests || 0));
      }
    }

    return totals;
  }

  private calculateRatings(requestCounts: Map<string, number>): Record<string, number> {
    const modelsWithUsage = Array.from(requestCounts.entries()).filter(([, count]) => count > 0);

    if (modelsWithUsage.length === 0) {
      return {};
    }

    if (modelsWithUsage.length === 1) {
      return { [modelsWithUsage[0][0]]: ModelPopularityService.MAX_STARS };
    }

    const logValues = modelsWithUsage.map(([id, count]) => ({
      id,
      logValue: Math.log(count),
    }));

    const logMin = Math.min(...logValues.map((v) => v.logValue));
    const logMax = Math.max(...logValues.map((v) => v.logValue));

    if (logMin === logMax) {
      const ratings: Record<string, number> = {};
      for (const { id } of logValues) {
        ratings[id] = 3;
      }
      return ratings;
    }

    const ratings: Record<string, number> = {};
    const range = logMax - logMin;

    for (const { id, logValue } of logValues) {
      const normalized = (logValue - logMin) / range;
      ratings[id] = Math.round(
        ModelPopularityService.MIN_STARS +
          (ModelPopularityService.MAX_STARS - ModelPopularityService.MIN_STARS) * normalized,
      );
    }

    return ratings;
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
