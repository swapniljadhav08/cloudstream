# Folder Structure

## Purpose

This document defines the complete project folder structure for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

All directory and file organization for frontend, backend, and infrastructure.

## Audience

- Engineering Teams
- DevOps Engineers
- Technical Leads

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [04_System_Architecture.md](./04_System_Architecture.md) - System architecture

## Related Documents

- [05_Tech_Stack.md](./05_Tech_Stack.md) - Technology stack
- [22_Microservices.md](./22_Microservices.md) - Service boundaries

## Table of Contents

1. [Root Structure](#root-structure)
2. [Backend Structure](#backend-structure)
3. [Frontend Structure](#frontend-structure)
4. [Infrastructure Structure](#infrastructure-structure)
5. [Design Decisions](#design-decisions)
6. [Notes](#notes)
7. [References](#references)
8. [Future Documents](#future-documents)
9. [Revision History](#revision-history)

## Root Structure

```
video-streaming-platform/
├── docs/
│   ├── diagrams/
│   ├── assets/
│   └── *.md
├── frontend/
├── backend/
├── infrastructure/
├── .github/
│   └── workflows/
├── .husky/
├── .vscode/
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Backend Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   └── services/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   ├── value-objects/
│   │   │   │   └── services/
│   │   │   ├── infrastructure/
│   │   │   │   ├── repositories/
│   │   │   │   └── services/
│   │   │   └── presentation/
│   │   │       ├── controllers/
│   │   │       ├── guards/
│   │   │       └── dtos/
│   │   ├── user/
│   │   ├── video/
│   │   └── admin/
│   ├── shared/
│   │   ├── kernel/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── app.module.ts
│   ├── main.ts
│   └── bootstrap.ts
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── Dockerfile
├── tsconfig.json
└── package.json
```

## Frontend Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── library/
│   │   ├── player/
│   │   └── admin/
│   ├── components/
│   │   ├── ui/
│   │   ├── video/
│   │   ├── forms/
│   │   └── layout/
│   ├── lib/
│   │   ├── api/
│   │   ├── utils/
│   │   └── validations/
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   ├── styles/
│   ├── middleware.ts
│   ├── layout.tsx
│   └── page.tsx
├── public/
├── test/
├── Dockerfile
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

## Infrastructure Structure

```
infrastructure/
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── worker.Dockerfile
├── kubernetes/
│   ├── base/
│   ├── development/
│   └── production/
├── terraform/
│   ├── modules/
│   └── environments/
├── scripts/
│   ├── setup.sh
│   └── deploy.sh
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── helm/
    └── video-streaming-platform/
```

## Design Decisions

### Decision: Monorepo Structure

**Status**: Accepted

**Context**: Multiple applications (frontend, backend, workers) with shared code.

**Decision**: Use pnpm workspace for monorepo management.

**Consequences**:
- Shared types between frontend and backend
- Atomic changes across packages
- Simplified dependency management

### Decision: Clean Architecture Layers

**Status**: Accepted

**Context**: Need for maintainable, testable code.

**Decision**: Implement four-layer architecture (presentation, application, domain, infrastructure).

**Consequences**:
- Clear separation of concerns
- Easy to test business logic
- Framework agnostic core

## Notes

- All folder names use kebab-case
- Each module is self-contained
- Shared code is in the shared directory

## References

- [NestJS Folder Structure](https://docs.nestjs.com)
- [Next.js App Router](https://nextjs.org/docs/app)

## Future Documents

- [22_Microservices.md](./22_Microservices.md) - Service extraction
- [16_Deployment.md](./16_Deployment.md) - Deployment configuration

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Architecture Team | Initial version |