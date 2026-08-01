# UI Flow

## Purpose

This document defines the user interface flow and navigation for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

User journeys, navigation patterns, and UI workflows.

## Audience

- Frontend Engineers
- UI/UX Designers
- Product Managers

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [03_PRD.md](./03_PRD.md) - Product requirements
- [24_UI_UX.md](./24_UI_UX.md) - UI/UX design

## Related Documents

- [08_API_Design.md](./08_API_Design.md) - API design
- [09_Authentication.md](./09_Authentication.md) - Authentication

## Table of Contents

1. [User Journey](#user-journey)
2. [Navigation Flow](#navigation-flow)
3. [Authentication Flow](#authentication-flow)
4. [Dashboard Flow](#dashboard-flow)
5. [Upload Flow](#upload-flow)
6. [Video Playback Flow](#video-playback-flow)
7. [Admin Flow](#admin-flow)
8. [Responsive Strategy](#responsive-strategy)
9. [Wireframe Navigation](#wireframe-navigation)
10. [Design Decisions](#design-decisions)
11. [Notes](#notes)
12. [References](#references)
13. [Future Documents](#future-documents)
14. [Revision History](#revision-history)

## User Journey

```mermaid
journey
    title User Journey
    section Onboarding
        Landing: 5: Visit platform
        Sign Up: 3: Create account
        Verify: 5: Email verification
    section First Video
        Upload: 5: Upload video
        Process: 3: Wait for processing
        Share: 5: Get shareable link
    section Regular Use
        Library: 5: Manage videos
        Analytics: 3: View stats
        Settings: 5: Update profile
```

## Navigation Flow

```mermaid
graph TD
    subgraph "Navigation"
        LANDING[Landing Page]
        AUTH[Auth Pages]
        DASH[Dashboard]
        LIBRARY[Video Library]
        PLAYER[Video Player]
        ADMIN[Admin Panel]
        SETTINGS[Settings]
    end
    
    LANDING -->|Login| AUTH
    LANDING -->|Sign Up| AUTH
    AUTH -->|Success| DASH
    DASH -->|Videos| LIBRARY
    DASH -->|Upload| UPLOAD[Upload Page]
    LIBRARY -->|Play| PLAYER
    LIBRARY -->|Settings| SETTINGS
    PLAYER -->|Back| LIBRARY
    DASH -->|Admin| ADMIN
```

## Authentication Flow

```mermaid
flowchart TD
    A[Visit Login] --> B[Enter Credentials]
    B --> C{Valid?}
    C -->|No| D[Show Error]
    D --> B
    C -->|Yes| E[Get JWT Token]
    E --> F[Store Token]
    F --> G[Redirect to Dashboard]
    
    H[Token Expired] --> I[Refresh Token]
    I --> J{Valid?}
    J -->|No| K[Redirect to Login]
    J -->|Yes| L[Get New Token]
    L --> M[Continue]
```

### Authentication State

```mermaid
stateDiagram-v2
    [*] --> UNAUTHENTICATED: Initial
    UNAUTHENTICATED --> AUTHENTICATED: Login success
    AUTHENTICATED --> UNAUTHENTICATED: Logout
    AUTHENTICATED --> TOKEN_EXPIRED: Token expired
    TOKEN_EXPIRED --> AUTHENTICATED: Token refresh
    TOKEN_EXPIRED --> UNAUTHENTICATED: Refresh failed
```

## Dashboard Flow

```mermaid
flowchart TD
    A[Dashboard Load] --> B[Fetch Stats]
    B --> C[Fetch Recent Videos]
    C --> D[Render Dashboard]
    D --> E{User Action}
    E -->|Upload| F[Go to Upload]
    E -->|Library| G[Go to Library]
    E -->|Settings| H[Go to Settings]
    E -->|Admin| I[Go to Admin]
```

### Dashboard Layout

```mermaid
graph TD
    subgraph "Dashboard Layout"
        HEADER[Header]
        STATS[Stats Cards]
        RECENT[Recent Videos]
        QUICK[Quick Actions]
    end
    
    HEADER --> STATS
    HEADER --> RECENT
    HEADER --> QUICK
```

## Upload Flow

```mermaid
flowchart TD
    A[Select File] --> B[Validate File]
    B --> C{Valid?}
    C -->|No| D[Show Error]
    C -->|Yes| E[Upload to Storage]
    E --> F[Create Video Record]
    F --> G[Queue Processing Job]
    G --> H[Show Processing Status]
    H --> I{Complete?}
    I -->|No| J[Poll Status]
    J --> H
    I -->|Yes| K[Show Success]
```

### Chunked Upload Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Storage
    
    U->>F: Select large file
    F->>F: Split into chunks
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

## Video Playback Flow

```mermaid
flowchart TD
    A[Open Video Page] --> B[Load Video Metadata]
    B --> C[Initialize Player]
    C --> D[Load HLS Manifest]
    D --> E{Manifest Valid?}
    E -->|No| F[Show Error]
    E -->|Yes| G[Start Playback]
    G --> H{Buffering?}
    H -->|Yes| I[Show Loading]
    H -->|No| J[Play Video]
    J --> K[Track Progress]
    K --> L{Completed?}
    L -->|No| M[Continue Playing]
    M --> K
    L -->|Yes| N[Mark Complete]
```

### Player State Machine

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

## Admin Flow

```mermaid
flowchart TD
    A[Admin Login] --> B[Admin Dashboard]
    B --> C{Action}
    C -->|Users| D[User Management]
    C -->|Stats| E[System Stats]
    C -->|Jobs| F[Job Management]
    C -->|Settings| G[System Settings]
    
    D --> H[View Users]
    D --> I[Edit User]
    D --> J[Delete User]
    
    E --> K[View Metrics]
    E --> L[View Logs]
    
    F --> M[View Jobs]
    F --> N[Cancel Job]
```

## Responsive Strategy

```mermaid
graph LR
    subgraph "Breakpoints"
        MOBILE[Mobile<br/640px]
        TABLET[Tablet<br/768px]
        DESKTOP[Desktop<br/1024px]
        LARGE[Large<br/1280px]
    end
    
    subgraph "Layout"
        SINGLE[Single Column]
        DUAL[Two Columns]
        TRIPLE[Three Columns]
        QUAD[Four Columns]
    end
    
    MOBILE --> SINGLE
    TABLET --> DUAL
    DESKTOP --> TRIPLE
    LARGE --> QUAD
```

### Responsive Grid

```tsx
// Responsive video grid
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {videos.map(video => (
    <VideoCard key={video.id} video={video} />
  ))}
</div>
```

## Wireframe Navigation

```mermaid
graph TD
    subgraph "Pages"
        LANDING[Landing]
        LOGIN[Login]
        REGISTER[Register]
        DASHBOARD[Dashboard]
        UPLOAD[Upload]
        LIBRARY[Library]
        PLAYER[Player]
        SETTINGS[Settings]
        ADMIN[Admin]
    end
    
    subgraph "Components"
        HEADER[Header]
        SIDEBAR[Sidebar]
        FOOTER[Footer]
    end
    
    LANDING --> HEADER
    LOGIN --> HEADER
    REGISTER --> HEADER
    DASHBOARD --> HEADER
    DASHBOARD --> SIDEBAR
    UPLOAD --> HEADER
    UPLOAD --> SIDEBAR
    LIBRARY --> HEADER
    LIBRARY --> SIDEBAR
    PLAYER --> HEADER
    SETTINGS --> HEADER
    SETTINGS --> SIDEBAR
    ADMIN --> HEADER
    ADMIN --> SIDEBAR
```

## Design Decisions

### Decision: Protected Routes

**Status**: Accepted

**Context**: Need to secure authenticated pages.

**Decision**: Use middleware to protect routes.

**Consequences**:
- Automatic redirect to login
- Token validation
- Role-based access

### Decision: Responsive First

**Status**: Accepted

**Context**: Users access from multiple devices.

**Decision**: Mobile-first responsive design.

**Consequences**:
- Better mobile experience
- Progressive enhancement
- More CSS complexity

## Notes

- All navigation is client-side
- Authentication state is persisted
- UI is accessible
- Dark mode is supported

## References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Future Documents

- [30_API_Status_Codes.md](./30_API_Status_Codes.md) - API status codes

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Design Team | Initial version |