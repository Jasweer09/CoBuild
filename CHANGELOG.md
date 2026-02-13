# Changelog

All notable changes to the CoBuild platform will be documented in this file.

## [0.5.0] - 2026-02-13

### Added
- Billing module: Stripe Checkout, Customer Portal, subscription lifecycle
- Plan management: FREE, BASIC, PREMIUM, ENTERPRISE, ADD_ON tiers with Stripe price IDs
- Subscription CRUD with auto-free-plan assignment for new organizations
- Stripe webhook handler with idempotent event processing via StripeWebhookEvent table
- Credit system: balance tracking, transaction history, deduction with insufficient balance checks
- Feature usage tracking with per-org and per-chatbot limits, reset on billing cycle
- Invoice management synced from Stripe webhook events
- Frontend: Billing dashboard at /dashboard/billing with Subscription, Plans, Credits, Invoices tabs
- Frontend: Public pricing page at /pricing with monthly/yearly toggle and feature comparison

## [0.4.0] - 2026-02-13

### Added
- Knowledge Base module: web crawling, Q&A pairs, text training, embeddings
- Web crawler using Cheerio with recursive link following, depth/limit controls
- BullMQ workers: crawl-queue (async web crawling), training-queue (embedding generation)
- Embedding service: OpenAI text-embedding-3-small, text chunking, pgvector storage
- RAG pipeline: semantic search via cosine similarity, context-augmented system prompts
- Citation extraction from RAG results returned in SSE completion events
- Q&A pair CRUD with automatic embedding generation on create/update
- Text training with upsert semantics (unique per chatbot)
- Crawl page selection workflow: crawl → review pages → select → train
- Frontend: Knowledge Base management page at /dashboard/bots/[id]/knowledge
- Frontend: Web Sources tab (crawl jobs, expandable page list, page selection)
- Frontend: Q&A Pairs tab (CRUD, search, bulk add, active toggle)
- Frontend: Text Training tab (upsert, character count, delete confirmation)
- Frontend: Files tab (placeholder for future file upload support)

## [0.3.0] - 2025-02-13

### Added
- Chatbot CRUD module: create, list, get, update, delete with org-scoped access
- Conversation module: CRUD, message history, auto-titling, folder support, pinning
- AI module with Vercel AI SDK: Gemini 2.5 Flash (primary), Claude 3.5 Haiku (backup)
- SSE streaming chat endpoint (POST /api/ai/chat) with real-time token streaming
- Per-chatbot rate limiting via Redis (configurable messages/window)
- Frontend: chatbot list page with create/delete at /dashboard/bots
- Frontend: chatbot detail page with General, AI Settings, and Rate Limit tabs
- Frontend: real-time chat interface with SSE streaming, conversation sidebar, suggested messages

## [0.2.0] - 2025-02-13

### Added
- Full authentication system: signup, login, logout with JWT + refresh tokens
- Google OAuth integration via Passport.js with auto org creation
- Email verification flow with 6-digit OTP (Redis-backed, 10min TTL)
- Role-based access control (OWNER, ADMIN, MANAGER, AGENT, VIEWER)
- Global JwtAuthGuard + RolesGuard registered as APP_GUARDs
- @Public(), @Roles(), @CurrentUser() decorators
- User module with profile endpoints (GET /user/me, PATCH /user/me, GET /user/team)
- Tenant module with org management (GET /tenant, PATCH /tenant)
- Frontend: working login, signup, email verification, Google OAuth callback pages
- Frontend: API client (fetch wrapper), Zustand auth store with token management

## [0.1.0] - 2025-02-13

### Added
- Initial monorepo setup with Turborepo + pnpm workspaces
- NestJS v11 API skeleton with core modules (config, database, cache, queue)
- Next.js 15 web application with shadcn/ui + Tailwind v4
- Next.js 15 admin panel
- Full PostgreSQL Prisma schema (48 tables with pgvector)
- Shared packages (ui, shared, email-templates, widget, mcp-server, eslint-config)
- Docker Compose for local development (PostgreSQL + Redis)
- GitHub Actions CI pipeline (lint, types, test, build)
