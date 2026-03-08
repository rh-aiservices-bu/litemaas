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

export type BackupJobState = 'idle' | 'running' | 'completed' | 'failed';

export interface BackupJobProgress {
  currentTable: string;
  tablesCompleted: number;
  tablesTotal: number;
  rowsProcessed: number;
  rowsTotal: number;
  elapsed: number;
}

export interface BackupJobStatus {
  state: BackupJobState;
  database?: BackupDatabaseType;
  progress?: BackupJobProgress;
  backup?: BackupInfo;
  error?: string;
  startedAt?: string;
  completedAt?: string;
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
