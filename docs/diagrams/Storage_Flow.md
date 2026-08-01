# Storage Flow

## Purpose

This document defines the storage flow for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Object storage operations, file management, and CDN integration.

## Audience

- Backend Engineers
- DevOps Engineers
- System Architects

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [13_Storage_Architecture.md](../13_Storage_Architecture.md) - Storage
- [33_Bucket_Structure.md](../33_Bucket_Structure.md) - Bucket structure

## Related Documents

- [Upload_Flow.md](./Upload_Flow.md) - Upload
- [Transcoding_Flow.md](./Transcoding_Flow.md) - Transcoding

## Storage Flow Diagram

```mermaid
flowchart TD
    A[Upload request] --> B[Validate]
    B --> C{Valid?}
    C -->|No| D[Reject]
    C -->|Yes| E[Store in MinIO]
    E --> F[Return URL]
    F --> G[Create record]
    
    H[Stream request] --> I[Check access]
    I --> J{Allowed?}
    J -->|No| K[Reject]
    J -->|Yes| L[Generate signed URL]
    L --> M[Stream from storage]
```

## Storage Architecture

```mermaid
graph TD
    subgraph "Storage Layers"
        APP[Application]
        MINIO[MinIO<br/>Development]
        R2[Cloudflare R2<br/>Production]
        CDN[CDN<br/>Cloudflare]
    end
    
    APP --> MINIO
    APP --> R2
    R2 --> CDN
```

## File Operations

```mermaid
sequenceDiagram
    participant A as API
    participant S as Storage
    participant DB as Database
    
    A->>S: Upload file
    S-->>A: Return URL
    A->>DB: Create record
    A->>S: Generate signed URL
    S-->>A: Return signed URL
    A->>S: Delete file
    S-->>A: Confirm delete
```

## Directory Structure

```mermaid
graph TD
    A[Bucket]
    A --> B[original/]
    A --> C[transcoded/]
    A --> D[thumbnails/]
    A --> E[preview/]
    A --> F[segments/]
    A --> G[temp/]
    A --> H[logs/]
    A --> I[backup/]
```

## Cache Strategy

```mermaid
flowchart TD
    A[Request] --> B{Cache check}
    B -->|Hit| C[Return cached]
    B -->|Miss| D[Fetch from storage]
    D --> E[Cache result]
    E --> F[Return]
```

## Lifecycle Management

```mermaid
flowchart TD
    A[File created] --> B[Set tags]
    B --> C[Monitor age]
    C --> D{Expired?}
    D -->|No| C
    D -->|Yes| E[Delete]
    E --> F[Update database]
```

## Security Flow

```mermaid
flowchart TD
    A[Storage request] --> B[Validate token]
    B --> C{Valid?}
    C -->|No| D[Reject]
    C -->|Yes| E[Check permissions]
    E --> F{Allowed?}
    F -->|No| G[Reject]
    F -->|Yes| H[Generate signed URL]
    H --> I[Return URL]
```

## Design Decisions

### Decision: MinIO for Development

**Status**: Accepted

**Context**: Need for S3-compatible storage in development.

**Decision**: Use MinIO locally, Cloudflare R2 in production.

**Consequences**:
- Same API for both environments
- No vendor lock-in
- Easy local development

## Notes

- All files are stored with UUID-based names
- Storage is isolated per environment
- CDN is optional for production
- Lifecycle rules are automated

## References

- [MinIO Documentation](https://min.io/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Infrastructure Team | Initial version |