# Changelog

All notable changes to the CoBuild platform will be documented in this file.

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
