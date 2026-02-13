import type { USER_ROLES, PLAN_TYPES } from '../constants';

export type UserRole = (typeof USER_ROLES)[number];
export type PlanType = (typeof PLAN_TYPES)[number];

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface PaginatedResponse<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Citation {
  content: string;
  source: string;
  sourceUrl?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: string;
  citations?: Citation[];
}
