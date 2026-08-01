# Queue Flow

## Purpose

This document defines the job queue flow for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

BullMQ queue management, worker processing, and job lifecycle.

## Audience

- Backend Engineers
- DevOps Engineers
- System Architects

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [12_Queue_System.md](../12_Queue_System.md) - Queue system
- [21_Background_Jobs.md](../21_Background_Jobs.md) - Background jobs

## Related Documents

- [Transcoding_Flow.md](./Transcoding_Flow.md) - Transcoding
- [Storage_Flow.md](./Storage_Flow.md) - Storage

## Queue Flow Diagram

```mermaid
flowchart TD
    A[API request] --> B[Create job]
    B --> C[Add to queue]
    C --> D[Redis]
    D --> E[Worker picks up]
    E --> F[Process job]
    F --> G{Job complete?}
    G -->|No| H[Retry]
    H --> D
    G -->|Yes| I[Update status]
    I --> J[Notify]
    I --> K[Remove from queue]
```

## Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> WAITING: Job added
    WAITING --> ACTIVE: Worker picks up
    ACTIVE --> COMPLETED: Success
    ACTIVE --> FAILED: Error
    FAILED --> WAITING: Retry
    COMPLETED --> [*]
    FAILED --> [*]: Max retries
```

## Queue Architecture

```mermaid
graph TD
    subgraph "Queues"
        Q1[Transcode Queue]
        Q2[Thumbnail Queue]
        Q3[Metadata Queue]
    end
    
    subgraph "Workers"
        W1[Transcode Worker]
        W2[Thumbnail Worker]
        W3[Metadata Worker]
    end
    
    subgraph "Storage"
        R[(Redis)]
    end
    
    Q1 --> R
    Q2 --> R
    Q3 --> R
    R --> W1
    R --> W2
    R --> W3
```

## Priority System

```mermaid
flowchart TD
    A[New job] --> B{User role}
    B -->|Super Admin| C[Priority 1]
    B -->|Admin| D[Priority 5]
    B -->|Paid user| E[Priority 10]
    B -->|Free user| F[Priority 20]
    C --> G[Queue]
    D --> G
    E --> G
    F --> G
```

## Retry Strategy

```mermaid
flowchart TD
    A[Job fails] --> B{Attempt < 3?}
    B -->|No| C[Mark failed]
    B -->|Yes| D[Wait]
    D --> E[Exponential backoff]
    E --> F[Retry]
    F --> G[Queue]
```

## Monitoring

```mermaid
graph TD
    A[Queue] --> B[Metrics]
    B --> C[Waiting jobs]
    B --> D[Active jobs]
    B --> E[Completed jobs]
    B --> F[Failed jobs]
    C --> G[Prometheus]
    D --> G
    E --> G
    F --> G
    G --> H[Grafana]
```

## Design Decisions

### Decision: BullMQ

**Status**: Accepted

**Context**: Need for Redis-based job queue with good Node.js support.

**Decision**: Use BullMQ for job queue management.

**Consequences**:
- Redis dependency
- Good Node.js integration
- Built-in retry and scheduling

## Notes

- Workers are stateless
- Jobs are idempotent
- Queue metrics are exposed
- Dead letter queue for failed jobs

## References

- [BullMQ Documentation](https://docs.bullmq.io)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Backend Team | Initial version |