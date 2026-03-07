import { apiClient } from './api';

// Types matching backend
export type BackupDatabaseType = 'litemaas' | 'litellm';

export interface BackupMetadata {
  formatVersion: string;
  database: BackupDatabaseType;
  timestamp: string;
  appVersion: string;
  tableCount: number;
  rowCounts: Record<string, number>;
}

export interface BackupCapabilities {
  litemaasAvailable: boolean;
  litellmAvailable: boolean;
  litellmConfigured: boolean;
  storagePath: string;
}

export interface BackupInfo {
  id: string;
  filename: string;
  database: BackupDatabaseType;
  timestamp: string;
  size: number;
  metadata: BackupMetadata;
}

export interface RestoreResult {
  success: boolean;
  tablesRestored: number;
  rowsRestored: number;
  duration: number;
  warnings: string[];
}

export interface TestRestoreResult extends RestoreResult {
  testSchema: string;
}

class BackupService {
  /**
   * Get backup capabilities and configuration
   */
  async getCapabilities(): Promise<BackupCapabilities> {
    const response = await apiClient.get<{ data: BackupCapabilities }>(
      '/admin/backup/capabilities',
    );
    return response.data;
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    const response = await apiClient.get<{ data: BackupInfo[] }>('/admin/backup');
    return response.data;
  }

  /**
   * Create a new backup for the specified database
   */
  async createBackup(dbType: BackupDatabaseType): Promise<BackupInfo> {
    const response = await apiClient.post<{ data: BackupInfo }>('/admin/backup/create', {
      database: dbType,
    });
    return response.data;
  }

  /**
   * Download a backup file
   * Uses fetch directly to trigger browser download with auth
   */
  async downloadBackup(id: string): Promise<void> {
    // Get auth token for the download request
    const token = localStorage.getItem('access_token');
    const baseUrl = '/api/v1';
    const url = `${baseUrl}/admin/backup/${encodeURIComponent(id)}/download`;

    // Create a temporary link to trigger download with auth
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = id; // filename will be the id which includes .sql.gz
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(id: string): Promise<void> {
    await apiClient.delete(`/admin/backup/${encodeURIComponent(id)}`);
  }

  /**
   * Restore a backup to the database
   */
  async restoreBackup(id: string, database: BackupDatabaseType): Promise<RestoreResult> {
    const response = await apiClient.post<{ data: RestoreResult }>(
      `/admin/backup/${encodeURIComponent(id)}/restore`,
      { database },
    );
    return response.data;
  }

  /**
   * Test restore a backup (non-destructive)
   */
  async testRestoreBackup(
    id: string,
    database: BackupDatabaseType,
    testSchemaName?: string,
  ): Promise<TestRestoreResult> {
    const response = await apiClient.post<{ data: TestRestoreResult }>(
      `/admin/backup/${encodeURIComponent(id)}/test-restore`,
      { database, testSchemaName },
    );
    return response.data;
  }
}

export const backupService = new BackupService();
