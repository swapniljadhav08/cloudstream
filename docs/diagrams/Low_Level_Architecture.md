# Low Level Architecture

## Purpose

This document provides low-level architectural details of the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Internal component structure, module interactions, and data flow.

## Audience

- Backend Engineers
- System Architects
- DevOps Engineers

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [04_System_Architecture.md](../04_System_Architecture.md) - System architecture
- [06_Folder_Structure.md](../06_Folder_Structure.md) - Folder structure

## Related Documents

- [High_Level_Architecture.md](./High_Level_Architecture.md) - High-level overview
- [Component_Diagram.md](./Component_Diagram.md) - Component details

## Low Level Architecture Diagram

```mermaid
graph TD
    subgraph "Backend"
        MAIN[main.ts]
        APP[App Module]
    end
    
    subgraph "Modules"
        AUTH[Auth Module]
        USER[User Module]
        VIDEO[Video Module]
        ADMIN[Admin Module]
    end
    
    subgraph "Core Services"
        PRISMA[Prisma Service]
        REDIS[Redis Service]
        MINIO[MinIO Service]
        BULL[BullMQ Service]
        FFMPEG[FFmpeg Service]
    end
    
    subgraph "Infrastructure"
        DB[(PostgreSQL)]
        CACHE[(Redis)]
        STORAGE[MinIO/R2]
    end
    
    MAIN --> APP
    APP --> AUTH
    APP --> USER
    APP --> VIDEO
    APP --> ADMIN
    
    AUTH --> PRISMA
    USER --> PRISMA
    VIDEO --> PRISMA
    VIDEO --> MINIO
    VIDEO --> BULL
    VIDEO --> FFMPEG
    ADMIN --> PRISMA
    ADMIN --> REDIS
    
    PRISMA --> DB
    REDIS --> CACHE
    MINIO --> STORAGE
    BULL --> CACHE
```

## Module Architecture

### Auth Module

```mermaid
graph TD
    subgraph "Auth Module"
        AUTH_CONTROLLER[Auth Controller]
        AUTH_SERVICE[Auth Service]
        AUTH_REPOSITORY[Auth Repository]
    end
    
    subgraph "Auth Components"
        JWT[JWT Strategy]
        BCRYPT[bcrypt]
        EMAIL[Email Service]
    end
    
    AUTH_CONTROLLER --> AUTH_SERVICE
    AUTH_SERVICE --> AUTH_REPOSITORY
    AUTH_SERVICE --> JWT
    AUTH_SERVICE --> BCRYPT
    AUTH_SERVICE --> EMAIL
```

### Video Module

```mermaid
graph TD
    subgraph "Video Module"
        VIDEO_CONTROLLER[Video Controller]
        VIDEO_SERVICE[Video Service]
        VIDEO_REPOSITORY[Video Repository]
    end
    
    subgraph "Video Components"
        STORAGE[Storage Service]
        QUEUE[Queue Service]
        TRANSCODER[Transcoder Service]
    end
    
    VIDEO_CONTROLLER --> VIDEO_SERVICE
    VIDEO_SERVICE --> VIDEO_REPOSITORY
    VIDEO_SERVICE --> STORAGE
    VIDEO_SERVICE --> QUEUE
    VIDEO_SERVICE --> TRANSCODER
```

## Clean Architecture Layers

```mermaid
graph TD
    subgraph "Presentation Layer"
        CONTROLLER[Controller]
        GUARD[Guard]
        INTERCEPTOR[Interceptor]
    end
    
    subgraph "Application Layer"
        USECASE[Use Case]
        SERVICE[Application Service]
        DTO[DTO]
    end
    
    subgraph "Domain Layer"
        ENTITY[Entity]
        REPO_IFACE[Repository Interface]
        DOMAIN_SVC[Domain Service]
    end
    
    subgraph "Infrastructure Layer"
        REPO_IMPL[Repository Implementation]
        DB[Database]
        CACHE[Cache]
        STORAGE[Object Storage]
        QUEUE[Message Queue]
    end
    
    CONTROLLER --> USECASE
    USECASE --> ENTITY
    USECASE --> REPO_IFACE
    REPO_IFACE --> REPO_IMPL
    REPO_IMPL --> DB
    REPO_IMPL --> CACHE
    REPO_IMPL --> STORAGE
    REPO_IMPL --> QUEUE
```

## Service Dependencies

```mermaid
graph LR
    API[API Layer]
    SVC[Services]
    REPO[Repositories]
    EXT[External]
    
    API --> SVC
    SVC --> REPO
    REPO --> EXT
    
    subgraph "Services"
        AUTH_SVC[Auth Service]
        USER_SVC[User Service]
        VIDEO_SVC[Video Service]
    end
    
    subgraph "Repositories"
        AUTH_REPO[Auth Repository]
        USER_REPO[User Repository]
        VIDEO_REPO[Video Repository]
    end
    
    subgraph "External"
        DB[(Database)]
        CACHE[(Cache)]
        STORAGE[Storage]
        QUEUE[Queue]
    end
```

## Data Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API
    participant SVC as Service
    participant REPO as Repository
    participant DB as Database
    
    C->>API: Request
    API->>SVC: Process
    SVC->>REPO: Query
    REPO->>DB: SQL
    DB-->>REPO: Result
    REPO-->>SVC: Entity
    SVC-->>API: Response
    API-->>C: JSON
```

## Design Decisions

### Decision: Dependency Injection

**Status**: Accepted

**Context**: Need for testable, flexible code.

**Decision**: Use NestJS dependency injection.

**Consequences**:
- Easy to test
- Flexible configuration
- Clear dependencies

## Notes

- All modules follow Clean Architecture
- Services are stateless
- Repositories abstract data access
- External services are injected

## References

- [NestJS Documentation](https://docs.nestjs.com)
- [Clean Architecture](https://www.amazon.com/Clean-Architecture-Robert-C-Martin/dp/0134494164)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Architecture Team | Initial version |