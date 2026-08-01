# Upload Flow

## Purpose

This document defines the video upload flow for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Upload process, validation, and processing initiation.

## Audience

- Backend Engineers
- Frontend Engineers
- DevOps Engineers

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [11_Workflow.md](../11_Workflow.md) - Workflow
- [31_File_Upload_Policy.md](../31_File_Upload_Policy.md) - Upload policy

## Related Documents

- [Storage_Flow.md](./Storage_Flow.md) - Storage
- [Transcoding_Flow.md](./Transcoding_Flow.md) - Transcoding

## Upload Flow Diagram

```mermaid
flowchart TD
    A[User selects file] --> B[Validate file]
    B --> C{Valid?}
    C -->|No| D[Show error]
    C -->|Yes| E{File > 100MB?}
    E -->|Yes| F[Chunked upload]
    E -->|No| G[Direct upload]
    F --> H[Upload chunks]
    H --> I[Assemble chunks]
    G --> I
    I --> J[Create video record]
    J --> K[Queue processing job]
    K --> L[Return video ID]
    L --> M[Show processing status]
```

## Chunked Upload Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Storage
    
    U->>F: Select large file
    F->>F: Split into 50MB chunks
    F->>B: Initialize upload
    B-->>F: Return upload ID
    loop For each chunk
        F->>B: Upload chunk
        B->>S: Store chunk
        B-->>F: Return chunk ID
    end
    F->>B: Complete upload
    B->>B: Assemble chunks
    B->>B: Create video record
    B-->>F: Return video ID
```

## Validation Flow

```mermaid
flowchart TD
    A[File selected] --> B[Check format]
    B --> C{Valid format?}
    C -->|No| D[Reject - 415]
    C -->|Yes| E[Check size]
    E --> F{Size OK?}
    F -->|No| G[Reject - 413]
    F -->|Yes| H[Check quota]
    H --> I{Quota OK?}
    I -->|No| J[Reject - 403]
    I -->|Yes| K[Accept]
```

## Upload States

```mermaid
stateDiagram-v2
    [*] --> SELECTED: File selected
    SELECTED --> VALIDATING: Validate
    VALIDATING --> UPLOADING: Valid
    VALIDATING --> ERROR: Invalid
    UPLOADING --> PROCESSING: Upload complete
    UPLOADING --> ERROR: Upload failed
    PROCESSING --> COMPLETE: Processing done
    PROCESSING --> ERROR: Processing failed
    ERROR --> [*]
    COMPLETE --> [*]
```

## Error Handling

```mermaid
graph TD
    A[Upload Error] --> B{Error type}
    B -->|Network| C[Retry]
    B -->|Validation| D[Show error]
    B -->|Storage| E[Retry]
    B -->|Quota| F[Show quota error]
    C --> G[Exponential backoff]
    E --> G
    G --> H{Max retries?}
    H -->|No| I[Retry upload]
    H -->|Yes| J[Fail]
```

## Design Decisions

### Decision: 50MB Chunk Size

**Status**: Accepted

**Context**: Balance between reliability and overhead.

**Decision**: Use 50MB chunks for large file uploads.

**Consequences**:
- Good for most connections
- Reasonable number of chunks
- Memory efficient

## Notes

- All uploads are validated
- Chunked upload for files > 100MB
- Progress is tracked
- Errors are handled gracefully

## References

- [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Backend Team | Initial version |