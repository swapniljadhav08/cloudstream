# Transcoding Flow

## Purpose

This document defines the video transcoding flow for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

FFmpeg processing, output generation, and quality control.

## Audience

- Backend Engineers
- Video Engineers
- DevOps Engineers

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [15_Transcoding_Pipeline.md](../15_Transcoding_Pipeline.md) - Transcoding
- [32_FFmpeg_Profiles.md](../32_FFmpeg_Profiles.md) - FFmpeg profiles

## Related Documents

- [Queue_Flow.md](./Queue_Flow.md) - Queue
- [Storage_Flow.md](./Storage_Flow.md) - Storage

## Transcoding Flow Diagram

```mermaid
flowchart TD
    A[Job received] --> B[Download original]
    B --> C[Extract metadata]
    C --> D[Generate thumbnails]
    D --> E[Transcode to HLS]
    E --> F{All resolutions?}
    F -->|No| E
    F -->|Yes| G[Upload outputs]
    G --> H[Update database]
    H --> I[Send notification]
    I --> J[Mark complete]
```

## Processing Steps

```mermaid
sequenceDiagram
    participant Q as Queue
    participant W as Worker
    participant S as Storage
    participant DB as Database
    
    Q->>W: Process job
    W->>S: Download original
    W->>W: Extract metadata
    W->>W: Generate thumbnails
    W->>W: Transcode to HLS
    W->>S: Upload outputs
    W->>DB: Update status
    W->>Q: Acknowledge
```

## Resolution Processing

```mermaid
graph TD
    A[Input video] --> B[240p]
    A --> C[360p]
    A --> D[480p]
    A --> E[720p]
    A --> F[1080p]
    A --> G[4K]
    
    B --> H[HLS output]
    C --> H
    D --> H
    E --> H
    F --> H
    G --> H
```

## FFmpeg Processing

```mermaid
flowchart TD
    A[Input file] --> B[FFprobe]
    B --> C[Metadata]
    C --> D[FFmpeg]
    D --> E[Scale filter]
    E --> F[libx264]
    F --> G[aac audio]
    G --> H[HLS segments]
    H --> I[Upload]
```

## Progress Tracking

```mermaid
stateDiagram-v2
    [*] --> DOWNLOADING: Start
    DOWNLOADING --> METADATA: Download complete
    METADATA --> THUMBNAILS: Metadata extracted
    THUMBNAILS --> TRANSCODING: Thumbnails done
    TRANSCODING --> UPLOADING: Transcoding done
    UPLOADING --> COMPLETE: All uploaded
    DOWNLOADING --> FAILED: Error
    METADATA --> FAILED: Error
    THUMBNAILS --> FAILED: Error
    TRANSCODING --> FAILED: Error
    UPLOADING --> FAILED: Error
    FAILED --> RETRY: Retry
    RETRY --> DOWNLOADING
    RETRY --> FAILED: Max retries
```

## Error Handling

```mermaid
flowchart TD
    A[Transcoding error] --> B{Error type}
    B -->|Invalid format| C[Fail immediately]
    B -->|Corrupted| D[Retry once]
    B -->|Storage| E[Retry 3 times]
    B -->|FFmpeg crash| F[Retry 3 times]
    C --> G[Mark failed]
    D --> H[Retry]
    E --> I[Retry]
    F --> I
    I --> J{Max retries?}
    J -->|No| K[Continue]
    J -->|Yes| G
```

## Design Decisions

### Decision: Parallel Processing

**Status**: Accepted

**Context**: Need for faster video processing.

**Decision**: Process all resolutions in parallel.

**Consequences**:
- Faster processing
- More CPU usage
- Better user experience

## Notes

- FFmpeg runs in Docker container
- Processing is CPU-intensive
- Output is stored in object storage
- Progress is tracked in real-time

## References

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [HLS Specification](https://tools.ietf.org/html/draft-pantos-http-live-streaming)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Video Team | Initial version |