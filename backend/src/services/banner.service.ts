import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';
import type {
  Banner,
  CreateBannerRequest,
  UpdateBannerRequest,
  BannerAuditLog,
  BannerDbRow,
  BannerAuditLogDbRow,
} from '../types/banner.types';

export class BannerService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  /**
   * Get all active banners for a user, considering role targeting and dismissals
   */
  async getActiveBanners(userId?: string, userRoles?: string[]): Promise<Banner[]> {
    if (this.shouldUseMockData()) {
      return this.createMockResponse(this.getMockBanners());
    }

    try {
      const query = `
        SELECT b.* 
        FROM banner_announcements b
        WHERE b.is_active = true
          AND (b.start_date IS NULL OR b.start_date <= NOW())
          AND (b.end_date IS NULL OR b.end_date > NOW())
          AND (b.target_roles IS NULL OR b.target_roles && $1)
          AND (b.target_user_ids IS NULL OR $2 = ANY(b.target_user_ids) OR b.target_user_ids = '{}')
          AND (
            NOT b.is_dismissible 
            OR NOT EXISTS (
              SELECT 1 FROM user_banner_dismissals d 
              WHERE d.banner_id = b.id AND d.user_id = $2
            )
          )
        ORDER BY b.priority DESC, b.created_at DESC
        LIMIT 5
      `;

      const result = await this.fastify.pg.query<BannerDbRow>(query, [
        userRoles || [],
        userId || null,
      ]);

      return result.rows.map(this.mapBannerFromDb);
    } catch (error) {
      this.fastify.log.error({ error, userId, userRoles }, 'Failed to get active banners');
      throw error;
    }
  }

  /**
   * Get a banner by ID (admin only)
   */
  async getBannerById(bannerId: string): Promise<Banner | null> {
    if (this.shouldUseMockData()) {
      const mockBanner = this.getMockBanners().find((b) => b.id === bannerId);
      return this.createMockResponse(mockBanner || null);
    }

    try {
      const query = 'SELECT * FROM banner_announcements WHERE id = $1';
      const result = await this.fastify.pg.query<BannerDbRow>(query, [bannerId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapBannerFromDb(result.rows[0]);
    } catch (error) {
      this.fastify.log.error({ error, bannerId }, 'Failed to get banner by ID');
      throw error;
    }
  }

  /**
   * Get all banners regardless of active status (admin only)
   */
  async getAllBanners(): Promise<Banner[]> {
    if (this.shouldUseMockData()) {
      return this.createMockResponse(this.getMockBanners());
    }

    try {
      const query = `
        SELECT * 
        FROM banner_announcements
        ORDER BY created_at DESC
      `;

      const result = await this.fastify.pg.query<BannerDbRow>(query);
      return result.rows.map(this.mapBannerFromDb);
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to get all banners');
      throw error;
    }
  }

  /**
   * Create a new banner (admin only)
   */
  async createBanner(data: CreateBannerRequest, adminUserId: string): Promise<Banner> {
    if (this.shouldUseMockData()) {
      const mockBanner: Banner = {
        id: `banner_${Date.now()}`,
        name: data.name,
        isActive: data.isActive || false,
        priority: 0,
        content: data.content,
        variant: data.variant || 'info',
        isDismissible: data.isDismissible || false,
        dismissDurationHours: data.dismissDurationHours,
        startDate: data.startDate,
        endDate: data.endDate,
        targetRoles: data.targetRoles,
        targetUserIds: data.targetUserIds,
        linkUrl: data.linkUrl,
        linkText: data.linkText,
        markdownEnabled: data.markdownEnabled || false,
        createdBy: adminUserId,
        updatedBy: adminUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return this.createMockResponse(mockBanner);
    }

    const client = await this.fastify.pg.connect();

    try {
      await client.query('BEGIN');

      // If this banner is set to active, deactivate all other banners first
      if (data.isActive) {
        await client.query(
          'UPDATE banner_announcements SET is_active = false WHERE is_active = true',
        );
      }

      // Create banner
      const insertQuery = `
        INSERT INTO banner_announcements (
          name, is_active, content, variant, is_dismissible, dismiss_duration_hours,
          start_date, end_date, target_roles, target_user_ids,
          link_url, link_text, markdown_enabled, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
        RETURNING *
      `;

      const insertResult = await client.query<BannerDbRow>(insertQuery, [
        data.name,
        data.isActive || false,
        JSON.stringify(data.content),
        data.variant || 'info',
        data.isDismissible || false,
        data.dismissDurationHours,
        data.startDate,
        data.endDate,
        data.targetRoles,
        data.targetUserIds,
        data.linkUrl,
        data.linkText ? JSON.stringify(data.linkText) : null,
        data.markdownEnabled || false,
        adminUserId,
      ]);

      const banner = this.mapBannerFromDb(insertResult.rows[0]);

      // Create audit log
      await this.createAuditLog(
        client,
        banner.id,
        'create',
        adminUserId,
        null,
        insertResult.rows[0],
      );

      await client.query('COMMIT');

      this.fastify.log.info({ bannerId: banner.id, adminUserId }, 'Banner created successfully');
      return banner;
    } catch (error) {
      await client.query('ROLLBACK');
      this.fastify.log.error({ error, adminUserId }, 'Failed to create banner');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update a banner (admin only)
   */
  async updateBanner(
    bannerId: string,
    updates: UpdateBannerRequest,
    adminUserId: string,
  ): Promise<Banner> {
    if (this.shouldUseMockData()) {
      const mockBanner = this.getMockBanners().find((b) => b.id === bannerId);
      if (!mockBanner) {
        throw new Error('Banner not found');
      }
      const updatedBanner = { ...mockBanner, ...updates, updatedBy: adminUserId };
      return this.createMockResponse(updatedBanner);
    }

    const client = await this.fastify.pg.connect();

    try {
      await client.query('BEGIN');

      // Get current state for audit
      const currentState = await this.getBannerById(bannerId);
      if (!currentState) {
        throw new Error('Banner not found');
      }

      // If this banner is being set to active, deactivate all other banners first
      if (updates.isActive === true) {
        await client.query(
          'UPDATE banner_announcements SET is_active = false WHERE is_active = true AND id != $1',
          [bannerId],
        );
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(updates.name);
      }
      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(updates.isActive);
      }
      if (updates.content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.content));
      }
      if (updates.variant !== undefined) {
        updateFields.push(`variant = $${paramIndex++}`);
        updateValues.push(updates.variant);
      }
      if (updates.isDismissible !== undefined) {
        updateFields.push(`is_dismissible = $${paramIndex++}`);
        updateValues.push(updates.isDismissible);
      }
      if (updates.dismissDurationHours !== undefined) {
        updateFields.push(`dismiss_duration_hours = $${paramIndex++}`);
        updateValues.push(updates.dismissDurationHours);
      }
      if (updates.startDate !== undefined) {
        updateFields.push(`start_date = $${paramIndex++}`);
        updateValues.push(updates.startDate);
      }
      if (updates.endDate !== undefined) {
        updateFields.push(`end_date = $${paramIndex++}`);
        updateValues.push(updates.endDate);
      }
      if (updates.targetRoles !== undefined) {
        updateFields.push(`target_roles = $${paramIndex++}`);
        updateValues.push(updates.targetRoles);
      }
      if (updates.targetUserIds !== undefined) {
        updateFields.push(`target_user_ids = $${paramIndex++}`);
        updateValues.push(updates.targetUserIds);
      }
      if (updates.linkUrl !== undefined) {
        updateFields.push(`link_url = $${paramIndex++}`);
        updateValues.push(updates.linkUrl);
      }
      if (updates.linkText !== undefined) {
        updateFields.push(`link_text = $${paramIndex++}`);
        updateValues.push(updates.linkText ? JSON.stringify(updates.linkText) : null);
      }
      if (updates.markdownEnabled !== undefined) {
        updateFields.push(`markdown_enabled = $${paramIndex++}`);
        updateValues.push(updates.markdownEnabled);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      // Always update updatedBy and updatedAt
      updateFields.push(`updated_by = $${paramIndex++}`);
      updateValues.push(adminUserId);

      const updateQuery = `
        UPDATE banner_announcements 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      updateValues.push(bannerId);

      const updateResult = await client.query<BannerDbRow>(updateQuery, updateValues);

      if (updateResult.rows.length === 0) {
        throw new Error('Banner not found');
      }

      const banner = this.mapBannerFromDb(updateResult.rows[0]);

      // Clear all dismissals for this banner to make it visible again to all users
      const dismissalResult = await client.query(
        'DELETE FROM user_banner_dismissals WHERE banner_id = $1',
        [bannerId],
      );

      this.fastify.log.info(
        { bannerId, adminUserId, dismissalsCleared: dismissalResult.rowCount },
        'Cleared banner dismissals after update',
      );

      // Create audit log
      await this.createAuditLog(
        client,
        bannerId,
        'update',
        adminUserId,
        currentState,
        updateResult.rows[0],
      );

      await client.query('COMMIT');

      this.fastify.log.info({ bannerId, adminUserId }, 'Banner updated successfully');
      return banner;
    } catch (error) {
      await client.query('ROLLBACK');
      this.fastify.log.error({ error, bannerId, adminUserId }, 'Failed to update banner');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk update banner visibility states
   * Ensures only one banner can be active at a time
   */
  async bulkUpdateVisibility(
    visibilityUpdates: Record<string, boolean>,
    adminUserId: string,
  ): Promise<void> {
    if (this.shouldUseMockData()) {
      // Mock implementation - just log the operation
      this.fastify.log.info({ visibilityUpdates, adminUserId }, 'Mock bulk visibility update');
      return;
    }

    const client = await this.fastify.pg.connect();

    try {
      await client.query('BEGIN');

      // First, check if more than one banner is being set to active
      const activeBanners = Object.entries(visibilityUpdates).filter(([, isActive]) => isActive);
      if (activeBanners.length > 1) {
        throw new Error('Only one banner can be active at a time');
      }

      // If setting one banner to active, deactivate all others first
      if (activeBanners.length === 1) {
        await client.query(
          'UPDATE banner_announcements SET is_active = false WHERE is_active = true',
        );
      }

      // Apply each visibility update
      for (const [bannerId, isActive] of Object.entries(visibilityUpdates)) {
        const updateQuery = `
          UPDATE banner_announcements 
          SET is_active = $1, updated_by = $2, updated_at = NOW()
          WHERE id = $3
        `;
        await client.query(updateQuery, [isActive, adminUserId, bannerId]);

        // If activating a banner, clear its dismissals
        if (isActive) {
          await client.query('DELETE FROM user_banner_dismissals WHERE banner_id = $1', [bannerId]);
        }

        // Create audit log
        await this.createAuditLog(
          client,
          bannerId,
          isActive ? 'activate' : 'deactivate',
          adminUserId,
          { isActive: !isActive },
          { isActive, updated_by: adminUserId },
        );
      }

      await client.query('COMMIT');

      this.fastify.log.info(
        { visibilityUpdates, adminUserId },
        'Bulk visibility update completed successfully',
      );
    } catch (error) {
      await client.query('ROLLBACK');
      this.fastify.log.error(
        { error, visibilityUpdates, adminUserId },
        'Failed to bulk update banner visibility',
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Dismiss a banner for a user
   */
  async dismissBanner(bannerId: string, userId: string): Promise<void> {
    if (this.shouldUseMockData()) {
      return this.createMockResponse(undefined);
    }

    try {
      const query = `
        INSERT INTO user_banner_dismissals (user_id, banner_id) 
        VALUES ($1, $2) 
        ON CONFLICT (user_id, banner_id) DO NOTHING
      `;

      await this.fastify.pg.query(query, [userId, bannerId]);

      this.fastify.log.info({ bannerId, userId }, 'Banner dismissed successfully');
    } catch (error) {
      this.fastify.log.error({ error, bannerId, userId }, 'Failed to dismiss banner');
      throw error;
    }
  }

  /**
   * Get banner audit logs (admin only)
   */
  async getBannerAuditLogs(bannerId?: string): Promise<BannerAuditLog[]> {
    if (this.shouldUseMockData()) {
      return this.createMockResponse([]);
    }

    try {
      let query = 'SELECT * FROM banner_audit_log';
      const params: any[] = [];

      if (bannerId) {
        query += ' WHERE banner_id = $1';
        params.push(bannerId);
      }

      query += ' ORDER BY changed_at DESC LIMIT 100';

      const result = await this.fastify.pg.query<BannerAuditLogDbRow>(query, params);

      return result.rows.map(this.mapAuditLogFromDb);
    } catch (error) {
      this.fastify.log.error({ error, bannerId }, 'Failed to get banner audit logs');
      throw error;
    }
  }

  /**
   * Delete a banner (admin only)
   */
  async deleteBanner(bannerId: string, adminUserId: string): Promise<void> {
    if (this.shouldUseMockData()) {
      return this.createMockResponse(undefined);
    }

    const client = await this.fastify.pg.connect();

    try {
      await client.query('BEGIN');

      // Get current state for audit
      const currentState = await this.getBannerById(bannerId);
      if (!currentState) {
        throw new Error('Banner not found');
      }

      // Create audit log before deletion
      await this.createAuditLog(client, bannerId, 'delete', adminUserId, currentState, null);

      // Delete banner (this will cascade to dismissals and audit logs due to foreign keys)
      const deleteQuery = 'DELETE FROM banner_announcements WHERE id = $1';
      const deleteResult = await client.query(deleteQuery, [bannerId]);

      if (deleteResult.rowCount === 0) {
        throw new Error('Banner not found');
      }

      await client.query('COMMIT');

      this.fastify.log.info({ bannerId, adminUserId }, 'Banner deleted successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      this.fastify.log.error({ error, bannerId, adminUserId }, 'Failed to delete banner');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Banner interface
   */
  private mapBannerFromDb(row: BannerDbRow): Banner {
    return {
      id: row.id,
      name: row.name,
      isActive: row.is_active,
      priority: row.priority,
      content: row.content,
      variant: row.variant as any,
      isDismissible: row.is_dismissible,
      dismissDurationHours: row.dismiss_duration_hours,
      startDate: row.start_date,
      endDate: row.end_date,
      targetRoles: row.target_roles,
      targetUserIds: row.target_user_ids,
      linkUrl: row.link_url,
      linkText: row.link_text,
      markdownEnabled: row.markdown_enabled,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to BannerAuditLog interface
   */
  private mapAuditLogFromDb(row: BannerAuditLogDbRow): BannerAuditLog {
    return {
      id: row.id,
      bannerId: row.banner_id,
      action: row.action as any,
      changedBy: row.changed_by,
      previousState: row.previous_state,
      newState: row.new_state,
      changedAt: row.changed_at,
    };
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    client: any,
    bannerId: string,
    action: string,
    changedBy: string,
    previousState: any,
    newState: any,
  ): Promise<void> {
    const query = `
      INSERT INTO banner_audit_log 
      (banner_id, action, changed_by, previous_state, new_state)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await client.query(query, [
      bannerId,
      action,
      changedBy,
      previousState ? JSON.stringify(previousState) : null,
      newState ? JSON.stringify(newState) : null,
    ]);
  }

  /**
   * Get mock banners for development/testing
   */
  private getMockBanners(): Banner[] {
    return [
      {
        id: 'mock-banner-1',
        name: 'Welcome Banner',
        isActive: true,
        priority: 0,
        content: {
          en: 'Welcome to LiteMaaS! This is a test announcement.',
          es: '¡Bienvenido a LiteMaaS! Este es un anuncio de prueba.',
          fr: 'Bienvenue sur LiteMaaS ! Ceci est une annonce de test.',
        },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'mock-admin',
        updatedBy: 'mock-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mock-banner-2',
        name: 'Maintenance Notice',
        isActive: false,
        priority: 1,
        content: {
          en: 'Scheduled maintenance on Sunday at 2 AM UTC.',
          es: 'Mantenimiento programado el domingo a las 2 AM UTC.',
          fr: 'Maintenance programmée dimanche à 2h UTC.',
        },
        variant: 'warning',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'mock-admin',
        updatedBy: 'mock-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}
