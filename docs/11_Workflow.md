# Workflow

## Purpose

This document defines the business workflows and processes for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

User workflows, system processes, and business logic flows.

## Audience

- Product Managers
- Engineering Teams
- QA Engineers

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [02_Requirements.md](./02_Requirements.md) - System requirements
- [03_PRD.md](./03_PRD.md) - Product requirements

## Related Documents

- [12_Queue_System.md](./12_Queue_System.md) - Queue implementation
- [15_Transcoding_Pipeline.md](./15_Transcoding_Pipeline.md) - Video processing
- [21_Background_Jobs.md](./21_Background_Jobs.md) - Background jobs

## Table of Contents

1. [User Workflows](#user-workflows)
2. [System Workflows](#system-workflows)
3. [Business Rules](#business-rules)
4. [State Machines](#state-machines)
5. [Event Flows](#event-flows)
6. [Design Decisions](#design-decisions)
7. [Notes](#notes)
8. [References](#references)
9. [Future Documents](#future-documents)
10. [Revision History](#revision-history)

## User Workflows

### Video Upload Workflow

```mermaid
flowchart TD
    A[User selects video] --> B[Validate file]
    B --> C{Valid?}
    C -->|No| D[Show error]
    C -->|Yes| E[Upload to storage]
    E --> F[Create video record]
    F --> G[Queue processing job]
    G --> H[Return video ID]
    H --> I[Show processing status]
```

### User Registration Workflow

```mermaid
flowchart TD
    A[User submits form] --> B[Validate input]
    B --> C{Valid?}
    C -->|No| D[Show validation errors]
    C -->|Yes| E[Check email unique]
    E --> F{Email exists?}
    F -->|Yes| G[Show error]
    F -->|No| H[Hash password]
    H --> I[Create user]
    I --> J[Send verification email]
    J --> K[Redirect to login]
```

### Video Playback Workflow

```mermaid
flowchart TD
    A[User opens video page] --> B[Load video metadata]
    B --> C[Initialize player]
    C --> D[Load HLS manifest]
    D --> E[Start playback]
    E --> F{Buffering?}
    F -->|Yes| G[Show loading]
    F -->|No| H[Play video]
    H --> I[Track progress]
```

## System Workflows

### Transcoding Workflow

```mermaid
sequenceDiagram
    participant API as API
    participant Q as Queue
    participant W as Worker
    participant S as Storage
    participant DB as Database
    
    API->>S: Upload original
    API->>DB: Create video record
    API->>Q: Queue job
    Q->>W: Process job
    W->>S: Download original
    W->>W: Extract metadata
    W->>W: Generate thumbnails
    W->>W: Transcode to HLS
    W->>S: Upload outputs
    W->>DB: Update status
    W->>Q: Acknowledge job
```

### Storage Cleanup Workflow

```mermaid
flowchart TD
    A[Scheduled job] --> B[Find expired videos]
    B --> C{Expired videos found?}
    C -->|No| D[End]
    C -->|Yes| E[Delete from storage]
    E --> F[Update database]
    F --> G[Log cleanup]
    G --> D
```

## Business Rules

### Storage Quota Rules

| Rule | Description |
|------|-------------|
| R001 | Users cannot upload if storage quota exceeded |
| R002 | Storage used is updated after each upload |
| R003 | Warning email sent at 80% quota |
| R004 | Upload blocked at 100% quota |

### Video Processing Rules

| Rule | Description |
|------|-------------|
| R010 | Videos are processed in order of upload |
| R011 | Failed jobs are retried 3 times |
| R012 | Jobs are cancelled after max retries |
| R013 | Processing priority based on user tier |

### User Management Rules

| Rule | Description |
|------|-------------|
| R020 | Users are created with USER role |
| R021 | Only admins can change roles |
| R022 | Deleted users are soft-deleted |
| R023 | Email verification required for login |

## State Machines

### Video Status State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Video uploaded
    PENDING --> PROCESSING: Job started
    PROCESSING --> COMPLETED: All outputs done
    PROCESSING --> FAILED: Error occurred
    FAILED --> PENDING: Retry
    COMPLETED --> CANCELLED: User deleted
    PENDING --> CANCELLED: User cancelled
```

### User Status State Machine

```mermaid
stateDiagram-v2
    [*] --> INACTIVE: User created
    INACTIVE --> ACTIVE: Email verified
    ACTIVE --> SUSPENDED: Admin suspended
    SUSPENDED --> ACTIVE: Admin unsuspended
    ACTIVE --> DELETED: User deleted
    SUSPENDED --> DELETED: User deleted
```

## Event Flows

### Video Events

```mermaid
graph LR
    A[VideoUploaded] --> B[VideoQueued]
    B --> C[ProcessingStarted]
    C --> D[ProcessingCompleted]
    D --> E[VideoReady]
    C --> F[ProcessingFailed]
    F --> G[RetryScheduled]
```

### User Events

```mermaid
graph LR
    A[UserRegistered] --> B[EmailSent]
    B --> C[EmailVerified]
    C --> D[UserActive]
    D --> E[ProfileUpdated]
    D --> F[StorageWarning]
    D --> G[StorageExceeded]
```

## Design Decisions

### Decision: Event-Driven Processing

**Status**: Accepted

**Context**: Video processing is long-running and asynchronous.

**Decision**: Use event-driven architecture with BullMQ.

**Consequences**:
- Decoupled components
- Better scalability
- Complex error handling

### Decision: Soft Delete

**Status**: Accepted

**Context**: Need to maintain data for audit and recovery.

**Decision**: Use soft delete with status field.

**Consequences**:
- Data recovery possible
- Audit trail maintained
- Query complexity

## Notes

- All workflows are idempotent
- State changes are logged
- Business rules are enforced at application level

## References

- [State Machine Pattern](https://refactoring.guru/design-patterns/state)

## Future Documents

- [12_Queue_System.md](./12_Queue_System.md) - Queue implementation
- [15_Transcoding_Pipeline.md](./15_Transcoding_Pipeline.md) - Video processing

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Product Team | Initial version |