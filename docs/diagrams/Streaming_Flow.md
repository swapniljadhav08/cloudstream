# Streaming Flow

## Purpose

This document defines the video streaming flow for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

HLS streaming, player integration, and adaptive quality.

## Audience

- Backend Engineers
- Frontend Engineers
- DevOps Engineers

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [14_Streaming_Architecture.md](../14_Streaming_Architecture.md) - Streaming
- [13_Storage_Architecture.md](../13_Storage_Architecture.md) - Storage

## Related Documents

- [Authentication_Flow.md](./Authentication_Flow.md) - Authentication
- [Storage_Flow.md](./Storage_Flow.md) - Storage

## Streaming Flow Diagram

```mermaid
flowchart TD
    A[User opens video] --> B[Load metadata]
    B --> C[Initialize player]
    C --> D[Load master manifest]
    D --> E{Manifest valid?}
    E -->|No| F[Show error]
    E -->|Yes| G[Select quality]
    G --> H[Load segment]
    H --> I[Play video]
    I --> J{Buffering?}
    J -->|Yes| K[Show loading]
    J -->|No| L[Continue playing]
    L --> M[Track progress]
    M --> N{Completed?}
    N -->|No| O[Next segment]
    O --> H
    N -->|Yes| P[Mark complete]
```

## HLS Flow

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

## Adaptive Quality Flow

```mermaid
flowchart TD
    A[Start playback] --> B[Measure bandwidth]
    B --> C{Bandwidth}
    C -->|> 5 Mbps| D[Select 1080p]
    C -->|2-5 Mbps| E[Select 720p]
    C -->|1-2 Mbps| F[Select 480p]
    C -->|< 1 Mbps| G[Select 360p]
    C -->|< 500 Kbps| H[Select 240p]
    D --> I[Load segment]
    E --> I
    F --> I
    G --> I
    H --> I
```

## Player State Machine

```mermaid
stateDiagram-v2
    [*] --> IDLE: Player loaded
    IDLE --> LOADING: Load video
    LOADING --> PLAYING: Video ready
    PLAYING --> PAUSED: User pause
    PAUSED --> PLAYING: User play
    PLAYING --> BUFFERING: Network issue
    BUFFERING --> PLAYING: Buffer filled
    PLAYING --> ENDED: Video ended
    ENDED --> IDLE: Reset
```

## Cache Flow

```mermaid
graph TD
    A[Request] --> B{CDN cache?}
    B -->|Hit| C[Return cached]
    B -->|Miss| D[NGINX cache]
    D --> E{Cache hit?}
    E -->|Yes| F[Return cached]
    E -->|No| G[Fetch from storage]
    G --> H[Cache and return]
```

## Security Flow

```mermaid
flowchart TD
    A[Stream request] --> B[Validate token]
    B --> C{Valid?}
    C -->|No| D[Return 401]
    C -->|Yes| E[Check video access]
    E --> F{Owns or public?}
    F -->|No| G[Return 403]
    F -->|Yes| H[Generate signed URL]
    H --> I[Stream video]
```

## Design Decisions

### Decision: HLS Protocol

**Status**: Accepted

**Context**: Need for adaptive streaming with broad compatibility.

**Decision**: Use HLS as the primary streaming protocol.

**Consequences**:
- Apple device support
- Industry standard
- Requires segment generation

## Notes

- HLS is the only supported format
- Player is responsive
- Quality selection is automatic
- Cache headers are set appropriately

## References

- [HLS Specification](https://tools.ietf.org/html/draft-pantos-http-live-streaming)
- [Video.js Documentation](https://videojs.com/docs)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Streaming Team | Initial version |