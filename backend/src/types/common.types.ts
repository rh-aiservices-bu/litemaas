export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface TimePeriod {
  start: Date;
  end: Date;
}

export type TimeInterval = 'hour' | 'day' | 'week' | 'month';

// Database-related types
export type DatabaseRow = Record<string, unknown>;
export type QueryParameter = string | number | boolean | Date | null | string[] | number[] | boolean[] | Date[];

export interface QueryResult<T = DatabaseRow> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: Array<{
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ErrorResponse['error'];
}

export interface DatabaseUtils {
  query<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<QueryResult<T>>;
  queryOne<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<T | null>;
  queryMany<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<T[]>;
  withTransaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>;
}

export interface DatabaseClient {
  query<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<QueryResult<T>>;
  release(): void;
}

// Metadata interfaces for different entities
export interface BaseMetadata {
  [key: string]: unknown;
}

export interface ApiKeyMetadata extends BaseMetadata {
  description?: string;
  environment?: 'development' | 'staging' | 'production';
  department?: string;
  project?: string;
  createdBy?: string;
  tags?: string[];
}

export interface SubscriptionMetadata extends BaseMetadata {
  description?: string;
  businessUnit?: string;
  costCenter?: string;
  approvedBy?: string;
  billingReference?: string;
  notes?: string;
}

export interface UsageMetadata extends BaseMetadata {
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  sessionId?: string;
  requestId?: string;
}

export interface UserMetadata extends BaseMetadata {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
  lastLoginAt?: string;
  preferences?: Record<string, unknown>;
}
