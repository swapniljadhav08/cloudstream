# Sequence Diagrams

## Purpose

This document provides sequence diagrams for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

API interactions, data flow, and system workflows.

## Audience

- Backend Engineers
- System Architects
- QA Engineers

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [08_API_Design.md](../08_API_Design.md) - API design
- [11_Workflow.md](../11_Workflow.md) - Workflow

## Related Documents

- [Authentication_Flow.md](./Authentication_Flow.md) - Authentication
- [Transcoding_Flow.md](./Transcoding_Flow.md) - Transcoding

## Video Upload Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Storage
    participant Q as Queue
    participant DB as Database
    
    U->>F: Select video file
    F->>F: Validate file
    F->>B: POST /videos
    B->>S: Upload to storage
    B->>DB: Create video record
    B->>Q: Queue transcoding job
    B-->>F: Return video ID
    F-->>U: Show processing status
    Q->>W as Worker: Process job
    W->>S: Download original
    W->>W: Transcode to HLS
    W->>S: Upload outputs
    W->>DB: Update status
```

## Authentication Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant DB as Database
    participant R as Redis
    
    C->>A: POST /auth/login
    A->>DB: Find user by email
    A->>A: Verify password
    A->>A: Generate access token
    A->>R: Store refresh token
    A-->>C: Return tokens
    C->>A: GET /protected
    A->>A: Verify JWT
    A-->>C: Return data
```

## Video Streaming Sequence

```mermaid
sequenceDiagram
    participant V as Viewer
    participant P as Player
    participant N as NGINX
    participant S as Storage
    
    V->>P: Open video page
    P->>N: GET /videos/{id}/master.m3u8
    N->>S: Fetch manifest
    S-->>N: Return manifest
    N-->>P: Stream manifest
    P->>N: GET segment_0.ts
    N->>S: Fetch segment
    S-->>N: Return segment
    N-->>P: Stream segment
```

## Transcoding Sequence

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
    W->>Q: Acknowledge
```

## Error Handling Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant E as Error Handler
    participant L as Logger
    
    C->>A: Request
    A->>E: Handle error
    E->>L: Log error
    E-->>C: Return error response
```

## Cache Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant R as Redis
    participant DB as Database
    
    C->>A: Request
    A->>R: Check cache
    R-->>A: Cache miss
    A->>DB: Query database
    DB-->>A: Return data
    A->>R: Set cache
    A-->>C: Return response
```

## Design Decisions

### Decision: Sequence Diagrams

**Status**: Accepted

**Context**: Need for clear API interaction documentation.

**Decision**: Use Mermaid sequence diagrams for all workflows.

**Consequences**:
- Clear documentation
- Easy to understand
- Version control friendly

## Notes

- All sequences follow REST conventions
- Error handling is consistent
- Caching is implemented
- Security is built in

## References

- [Mermaid Documentation](https://mermaid.js.org)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Architecture Team | Initial version |