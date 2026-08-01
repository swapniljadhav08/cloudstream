# Component Diagram

## Purpose

This document provides component diagrams for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Frontend components, backend modules, and their interactions.

## Audience

- Frontend Engineers
- Backend Engineers
- System Architects

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [06_Folder_Structure.md](../06_Folder_Structure.md) - Folder structure
- [24_UI_UX.md](../24_UI_UX.md) - UI/UX

## Related Documents

- [Low_Level_Architecture.md](./Low_Level_Architecture.md) - Architecture
- [ER_Diagram.md](./ER_Diagram.md) - Database

## Frontend Component Diagram

```mermaid
graph TD
    subgraph "Frontend"
        APP[App Layout]
        AUTH[Auth Pages]
        DASH[Dashboard]
        LIB[Video Library]
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
    APP --> DASH
    APP --> LIB
    APP --> PLAYER
    APP --> ADMIN
    
    AUTH --> UI
    DASH --> UI
    LIB --> UI
    PLAYER --> UI
    ADMIN --> UI
    
    UI --> HOOKS
    HOOKS --> API
    API --> STORE
```

## Backend Component Diagram

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

## Worker Component Diagram

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

## UI Component Hierarchy

```mermaid
graph TD
    subgraph "UI Components"
        LAYOUT[Layout]
        FORMS[Forms]
        VIDEO[Video Components]
        DATA[Data Display]
    end
    
    subgraph "Layout"
        HEADER[Header]
        SIDEBAR[Sidebar]
        FOOTER[Footer]
    end
    
    subgraph "Forms"
        INPUT[Input]
        BUTTON[Button]
        FILE_UPLOAD[File Upload]
    end
    
    subgraph "Video Components"
        PLAYER[Video Player]
        CARD[Video Card]
        PROGRESS[Video Progress]
    end
    
    subgraph "Data Display"
        TABLE[Table]
        PAGINATION[Pagination]
        CHARTS[Charts]
    end
    
    LAYOUT --> HEADER
    LAYOUT --> SIDEBAR
    LAYOUT --> FOOTER
    FORMS --> INPUT
    FORMS --> BUTTON
    FORMS --> FILE_UPLOAD
    VIDEO --> PLAYER
    VIDEO --> CARD
    VIDEO --> PROGRESS
    DATA --> TABLE
    DATA --> PAGINATION
    DATA --> CHARTS
```

## Service Layer

```mermaid
graph TD
    subgraph "Application Services"
        AUTH_SVC[Auth Service]
        USER_SVC[User Service]
        VIDEO_SVC[Video Service]
        ADMIN_SVC[Admin Service]
    end
    
    subgraph "Infrastructure Services"
        EMAIL[Email Service]
        STORAGE[Storage Service]
        CACHE[Cache Service]
        QUEUE[Queue Service]
    end
    
    AUTH_SVC --> EMAIL
    USER_SVC --> CACHE
    VIDEO_SVC --> STORAGE
    VIDEO_SVC --> QUEUE
    ADMIN_SVC --> CACHE
```

## Design Decisions

### Decision: Component-Based Architecture

**Status**: Accepted

**Context**: Need for maintainable, reusable code.

**Decision**: Use component-based architecture for both frontend and backend.

**Consequences**:
- Reusable components
- Clear boundaries
- Easy to test

## Notes

- All components are documented
- Components follow naming conventions
- Shared components are in shared directory
- UI components use shadcn/ui

## References

- [React Documentation](https://react.dev)
- [NestJS Documentation](https://docs.nestjs.com)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Architecture Team | Initial version |