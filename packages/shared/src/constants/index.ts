export const APP_NAME = 'CoBuild';

export const DEFAULT_AI_MODEL = 'gemini-2.5-flash';
export const FALLBACK_AI_MODEL = 'claude-3-5-haiku-20241022';
export const DEFAULT_TEMPERATURE = 0.7;

export const MAX_CHAT_DOCS_SIZE_MB = 10;
export const EMBEDDING_DIMENSIONS = 1536;
export const CHUNK_SIZE = 500;
export const CHUNK_OVERLAP = 50;

export const DEFAULT_RATE_LIMIT_MESSAGES = 20;
export const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 60;

export const USER_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'VIEWER'] as const;
export const PLAN_TYPES = ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE', 'ADD_ON'] as const;
