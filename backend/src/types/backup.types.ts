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
