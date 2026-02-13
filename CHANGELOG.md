# Changelog

All notable changes to the CoBuild platform will be documented in this file.

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
