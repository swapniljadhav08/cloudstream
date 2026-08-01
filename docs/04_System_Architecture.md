# System Architecture

## Purpose

This document defines the complete system architecture for the Automated Cloud-Native Video Transcoding and Streaming Platform, including component design, data flow, and deployment architecture.

## Scope

All architectural decisions, patterns, and system design for the platform.

## Audience

- Solution Architects
- Engineering Teams
- DevOps Engineers
- Technical Leads

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [01_Project_Vision.md](./01_Project_Vision.md) - Product vision
- [02_Requirements.md](./02_Requirements.md) - System requirements
- [03_PRD.md](./03_PRD.md) - Product requirements
- [05_Tech_Stack.md](./05_Tech_Stack.md) - Technology stack

## Related Documents

- [06_Folder_Structure.md](./06_Folder_Structure.md) - Project structure
- [07_Database_Schema.md](./07_Database_Schema.md) - Database design
- [08_API_Design.md](./08_API_Design.md) - API specification
- [12_Queue_System.md](./12_Queue_System.md) - Queue implementation
- [13_Storage_Architecture.md](./13_Storage_Architecture.md) - Storage design
- [15_Transcoding_Pipeline.md](./15_Transcoding_Pipeline.md) - Video processing

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Architectural Patterns](#architectural-patterns)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Deployment Architecture](#deployment-architecture)
6. [Security Architecture](#security-architecture)
7. [Scalability Architecture](#scalability-architecture)
8. [Resilience Architecture](#resilience-architecture)
9. [Technology Integration](#technology-integration)
10. [Design Decisions](#design-decisions)
11. [Notes](#notes)
12. [References](#references)
13. [Future Documents](#future-documents)
14. [Revision History](#revision-history)

## Architecture Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile Browser]
    end
    
    subgraph "Edge Layer"
        CDN[CDN<br/>Cloudflare R2]
        NGINX[NGINX<br/>Reverse Proxy]
    end
    
    subgraph "Application Layer"
        FRONTEND[Frontend<br/>Next.js 15]
        BACKEND[Backend<br/>NestJS/Fastify]
    end
    
    subgraph "Processing Layer"
        WORKER1[Transcoding Worker]
        WORKER2[Thumbnail Worker]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL 16)]
        CACHE[(Redis 7)]
        STORAGE[MinIO/R2<br/>Object Storage]
    end
    
    subgraph "Monitoring Layer"
        PROM[Prometheus]
        GRAF[Grafana]
        LOKI[Loki]
    end
    
    WEB --> NGINX
    MOBILE --> NGINX
    NGINX --> FRONTEND
    NGINX --> BACKEND
    BACKEND --> DB
    BACKEND --> CACHE
    BACKEND --> STORAGE
    BACKEND --> WORKER1
    BACKEND --> WORKER2
    WORKER1 --> STORAGE
    WORKER2 --> STORAGE
    BACKEND --> PROM
    PROM --> GRAF
    LOKI --> GRAF
```

### Architecture Principles

| Principle | Implementation |
|-----------|----------------|
| **Cloud Native** | Container-first, 12-factor app |
| **API First** | All features accessible via REST API |
| **Security First** | Authentication, authorization, encryption |
| **Scalable** | Horizontal scaling, stateless services |
| **Maintainable** | Clean architecture, modular monolith |
| **Observable** | Metrics, logs, tracing |
| **Resilient** | Retry mechanisms, circuit breakers |

## Architectural Patterns

### Clean Architecture

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

### Modular Monolith

```mermaid
graph TD
    subgraph "Modules"
        AUTH[Auth Module]
        USER[User Module]
        VIDEO[Video Module]
        ADMIN[Admin Module]
    end
    
    subgraph "Shared"
        KERNEL[Shared Kernel]
        COMMON[Common Utilities]
    end
    
    AUTH --> KERNEL
    USER --> KERNEL
    VIDEO --> KERNEL
    ADMIN --> KERNEL
    
    AUTH -.-> USER
    VIDEO -.-> USER
    ADMIN -.-> USER
    ADMIN -.-> VIDEO
```

### Event-Driven Architecture

```mermaid
graph LR
    subgraph "Events"
        UPLOAD[Video Uploaded]
        PROCESS[Processing Started]
        COMPLETE[Processing Complete]
        ERROR[Processing Failed]
    end
    
    subgraph "Handlers"
        QUEUE[Queue Job]
        NOTIFY[Send Notification]
        UPDATE[Update Database]
    end
    
    UPLOAD --> QUEUE
    QUEUE --> PROCESS
    PROCESS --> UPDATE
    UPDATE --> COMPLETE
    COMPLETE --> NOTIFY
    ERROR --> NOTIFY
```

## Component Architecture

### Frontend Components

```mermaid
graph TD
    subgraph "Frontend"
        APP[App Layout]
        AUTH[Auth Pages]
        DASHBOARD[Dashboard]
        LIBRARY[Video Library]
        PLAYER[Video Player]
        ADMIN[Admin Panel]
    end
    
    subgraph "Shared"
        UI[UI Components]
        HOOKS[Custom Hooks]
        API[API Client]
        STORE[State Store]
    end
    
    APP --> AUTH
    APP --> DASHBOARD
    APP --> LIBRARY
    APP --> PLAYER
    APP --> ADMIN
    
    AUTH --> UI
    DASHBOARD --> UI
    LIBRARY --> UI
    PLAYER --> UI
    ADMIN --> UI
    
    UI --> HOOKS
    HOOKS --> API
    API --> STORE
```

### Backend Components

```mermaid
graph TD
    subgraph "Backend"
        MAIN[main.ts]
        APP[App Module]
    end
    
    subgraph "Modules"
        AUTH_MOD[Auth Module]
        USER_MOD[User Module]
        VIDEO_MOD[Video Module]
        ADMIN_MOD[Admin Module]
    end
    
    subgraph "Core Services"
        PRISMA[Prisma Service]
        REDIS[Redis Service]
        MINIO[MinIO Service]
        BULL[BullMQ Service]
        FFMPEG[FFmpeg Service]
    end
    
    MAIN --> APP
    APP --> AUTH_MOD
    APP --> USER_MOD
    APP --> VIDEO_MOD
    APP --> ADMIN_MOD
    
    AUTH_MOD --> PRISMA
    USER_MOD --> PRISMA
    VIDEO_MOD --> PRISMA
    VIDEO_MOD --> MINIO
    VIDEO_MOD --> BULL
    VIDEO_MOD --> FFMPEG
    ADMIN_MOD --> PRISMA
    ADMIN_MOD --> REDIS
```

### Worker Components

```mermaid
graph TD
    subgraph "Workers"
        TRANSCODER[Transcoding Worker]
        THUMBNAIL[Thumbnail Worker]
    end
    
    subgraph "Services"
        FFMPEG_SVC[FFmpeg Service]
        MINIO_SVC[MinIO Service]
        PRISMA_SVC[Prisma Service]
    end
    
    TRANSCODER --> FFMPEG_SVC
    TRANSCODER --> MINIO_SVC
    TRANSCODER --> PRISMA_SVC
    
    THUMBNAIL --> FFMPEG_SVC
    THUMBNAIL --> MINIO_SVC
    THUMBNAIL --> PRISMA_SVC
```

## Data Flow

### Video Upload Flow

```mermaid
flowchart TD
    A[User selects video] --> B[Frontend validates]
    B --> C{File > 100MB?}
    C -->|Yes| D[Chunked upload]
    C -->|No| E[Direct upload]
    D --> F[Upload chunks to MinIO]
    E --> F
    F --> G[Create video record]
    G --> H[Queue transcoding job]
    H --> I[Return video ID]
    I --> J[WebSocket connection]
    J --> K[Real-time status updates]
```

### Transcoding Flow

```mermaid
flowchart TD
    A[Job picked from queue] --> B[Download original]
    B --> C[Extract metadata]
    C --> D[Generate thumbnails]
    D --> E[Transcode to HLS]
    E --> F{All resolutions done?}
    F -->|No| E
    F -->|Yes| G[Upload outputs]
    G --> H[Update database]
    H --> I[Send notification]
    I --> J[Mark job complete]
```

### Authentication Flow

```mermaid
flowchart TD
    A[Login request] --> B[Validate credentials]
    B --> C[Generate access token]
    C --> D[Generate refresh token]
    D --> E[Return tokens]
    E --> F[Access protected resource]
    F --> G{Token valid?}
    G -->|No| H[Return 401]
    G -->|Yes| I[Process request]
    I --> J[Return response]
```

## Deployment Architecture

### Development Environment

```mermaid
graph TD
    subgraph "Docker Compose"
        FRONTEND_DEV[Frontend<br/>:3000]
        BACKEND_DEV[Backend<br/>:3001]
        POSTGRES_DEV[(PostgreSQL<br/>:5432)]
        REDIS_DEV[(Redis<br/>:6379)]
        MINIO_DEV[MinIO<br/>:9000]
        NGINX_DEV[NGINX<br/>:80]
    end
    
    FRONTEND_DEV --> BACKEND_DEV
    BACKEND_DEV --> POSTGRES_DEV
    BACKEND_DEV --> REDIS_DEV
    BACKEND_DEV --> MINIO_DEV
    NGINX_DEV --> FRONTEND_DEV
    NGINX_DEV --> BACKEND_DEV
```

### Production Environment

```mermaid
graph TD
    subgraph "Load Balancer"
        LB[Cloudflare/CDN]
    end
    
    subgraph "Kubernetes Cluster"
        subgraph "Frontend"
            FE1[Frontend Pod 1]
            FE2[Frontend Pod 2]
        end
        
        subgraph "Backend"
            BE1[Backend Pod 1]
            BE2[Backend Pod 2]
        end
        
        subgraph "Workers"
            W1[Worker Pod 1]
            W2[Worker Pod 2]
        end
        
        subgraph "Infrastructure"
            DB[(PostgreSQL)]
            CACHE[(Redis)]
            STORAGE[Cloudflare R2]
        end
    end
    
    LB --> FE1
    LB --> FE2
    FE1 --> BE1
    FE2 --> BE2
    BE1 --> DB
    BE1 --> CACHE
    BE1 --> STORAGE
    BE2 --> DB
    BE2 --> CACHE
    BE2 --> STORAGE
    W1 --> STORAGE
    W2 --> STORAGE
```

### Container Architecture

```mermaid
graph TD
    subgraph "Multi-stage Build"
        BASE[Base Image<br/>node:22-alpine]
        DEPS[Install Dependencies]
        BUILD[Build Application]
        RUNTIME[Runtime Image<br/>node:22-alpine]
    end
    
    BASE --> DEPS
    DEPS --> BUILD
    BUILD --> RUNTIME
```

## Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth Service
    participant DB as Database
    participant R as Redis
    
    C->>A: POST /auth/login
    A->>DB: Validate credentials
    A->>A: Generate JWT
    A->>R: Store refresh token
    A-->>C: Return tokens
    C->>A: GET /protected
    A->>A: Verify JWT
    A-->>C: Return data
```

### Authorization Model

```mermaid
graph TD
    subgraph "RBAC"
        USER[User]
        ADMIN[Admin]
        SUPER_ADMIN[Super Admin]
    end
    
    subgraph "Permissions"
        UPLOAD[video:upload]
        DELETE[video:delete]
        MANAGE_USERS[user:manage]
        VIEW_STATS[stats:view]
    end
    
    USER --> UPLOAD
    USER --> DELETE
    ADMIN --> UPLOAD
    ADMIN --> DELETE
    ADMIN --> VIEW_STATS
    SUPER_ADMIN --> UPLOAD
    SUPER_ADMIN --> DELETE
    SUPER_ADMIN --> MANAGE_USERS
    SUPER_ADMIN --> VIEW_STATS
```

## Scalability Architecture

### Horizontal Scaling

```mermaid
graph TD
    subgraph "Auto-scaling"
        LB[Load Balancer]
        BE1[Backend 1]
        BE2[Backend 2]
        BE3[Backend 3]
    end
    
    subgraph "Metrics"
        CPU[CPU > 70%]
        MEM[Memory > 80%]
    end
    
    LB --> BE1
    LB --> BE2
    LB --> BE3
    
    CPU --> LB
    MEM --> LB
```

### Database Scaling

```mermaid
graph TD
    subgraph "Connection Pool"
        BE1[Backend 1]
        BE2[Backend 2]
        BE3[Backend 3]
    end
    
    subgraph "Database"
        DB[PostgreSQL]
        POOL[Connection Pool<br/>100 connections]
    end
    
    BE1 --> POOL
    BE2 --> POOL
    BE3 --> POOL
    POOL --> DB
```

## Resilience Architecture

### Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> CLOSED
    CLOSED --> OPEN: Failure threshold
    OPEN --> HALF_OPEN: Timeout
    HALF_OPEN --> CLOSED: Success
    HALF_OPEN --> OPEN: Failure
```

### Retry Mechanism

```mermaid
flowchart TD
    A[Operation] --> B{Success?}
    B -->|No| C[Wait 1s]
    C --> D[Retry]
    D --> E{Attempt < 3?}
    E -->|Yes| A
    E -->|No| F[Fail]
    B -->|Yes| G[Complete]
```

## Technology Integration

### Integration Matrix

| Component | Technology | Integration Type |
|-----------|------------|----------------|
| API | NestJS/Fastify | Internal |
| Database | PostgreSQL/Prisma | Internal |
| Cache | Redis | Internal |
| Storage | MinIO/S3 | Internal |
| Queue | BullMQ | Internal |
| Video Processing | FFmpeg | Internal |
| Frontend | Next.js | Internal |
| Monitoring | Prometheus | Internal |
| Logging | Loki | Internal |
| Visualization | Grafana | Internal |

### Data Flow Integration

```mermaid
graph LR
    subgraph "Request Flow"
        REQ[Request]
        AUTH[Auth Check]
        CACHE[Cache Check]
        DB[Database]
        RESP[Response]
    end
    
    REQ --> AUTH
    AUTH --> CACHE
    CACHE --> DB
    DB --> RESP
```

## Design Decisions

### Decision: Modular Monolith

**Status**: Accepted

**Context**: Need for fast initial development with clear service boundaries.

**Decision**: Implement as modular monolith with potential for microservice extraction.

**Consequences**:
- Faster initial development
- Shared database with clear module boundaries
- Clear path to microservices

### Decision: Event-Driven Processing

**Status**: Accepted

**Context**: Video processing is long-running and should not block API requests.

**Decision**: Use BullMQ for asynchronous job processing.

**Consequences**:
- Decoupled processing
- Retry mechanisms
- Progress tracking

### Decision: HLS Streaming

**Status**: Accepted

**Context**: Need for adaptive streaming with broad device support.

**Decision**: Use HLS as the primary streaming protocol.

**Consequences**:
- Apple device compatibility
- Requires segment generation
- Industry standard

### Decision: MinIO for Development

**Status**: Accepted

**Context**: Need for S3-compatible storage in development.

**Decision**: Use MinIO locally, Cloudflare R2 in production.

**Consequences**:
- Same API for both environments
- No vendor lock-in
- Easy local development

## Notes

- Architecture supports horizontal scaling
- All components are containerized
- Security is built into every layer
- Monitoring is comprehensive

## References

- [Clean Architecture - Robert Martin](https://www.amazon.com/Clean-Architecture-Robert-C-Martin/dp/0134494164)
- [Twelve-Factor App](https://12factor.net)

## Future Documents

- [06_Folder_Structure.md](./06_Folder_Structure.md) - Project structure
- [07_Database_Schema.md](./07_Database_Schema.md) - Database design
- [08_API_Design.md](./08_API_Design.md) - API specification
- [12_Queue_System.md](./12_Queue_System.md) - Queue implementation
- [13_Storage_Architecture.md](./13_Storage_Architecture.md) - Storage design
- [15_Transcoding_Pipeline.md](./15_Transcoding_Pipeline.md) - Video processing

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Architecture Team | Initial version |