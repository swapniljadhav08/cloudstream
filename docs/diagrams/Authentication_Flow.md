# Authentication Flow

## Purpose

This document defines the authentication flow for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Login, registration, token management, and authorization.

## Audience

- Backend Engineers
- Frontend Engineers
- Security Engineers

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [09_Authentication.md](../09_Authentication.md) - Authentication
- [10_User_Roles.md](../10_User_Roles.md) - User roles

## Related Documents

- [Upload_Flow.md](./Upload_Flow.md) - Upload
- [Streaming_Flow.md](./Streaming_Flow.md) - Streaming

## Authentication Flow Diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
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

## Registration Flow

```mermaid
flowchart TD
    A[Register] --> B[Validate input]
    B --> C{Valid?}
    C -->|No| D[Show errors]
    C -->|Yes| E[Check email unique]
    E --> F{Email exists?}
    F -->|Yes| G[Show error]
    F -->|No| H[Hash password]
    H --> I[Create user]
    I --> J[Send verification email]
    J --> K[Redirect to login]
```

## Token Flow

```mermaid
flowchart TD
    A[Access Token] --> B{Valid?}
    B -->|No| C[Return 401]
    B -->|Yes| D[Process request]
    D --> E{Expired?}
    E -->|Yes| F[Use refresh token]
    F --> G{Refresh valid?}
    G -->|No| H[Return 401]
    G -->|Yes| I[Generate new access token]
    I --> J[Return new token]
```

## Authorization Flow

```mermaid
flowchart TD
    A[Request resource] --> B{Authenticated?}
    B -->|No| C[Return 401]
    B -->|Yes| D[Check ownership]
    D --> E{Owns resource?}
    E -->|No| F[Check role]
    F --> G{Admin or Super?}
    G -->|No| H[Return 403]
    G -->|Yes| I[Allow access]
    E -->|Yes| I
```

## Token State Machine

```mermaid
stateDiagram-v2
    [*] --> UNAUTHENTICATED: Initial
    UNAUTHENTICATED --> AUTHENTICATED: Login success
    AUTHENTICATED --> UNAUTHENTICATED: Logout
    AUTHENTICATED --> TOKEN_EXPIRED: Token expired
    TOKEN_EXPIRED --> AUTHENTICATED: Token refresh
    TOKEN_EXPIRED --> UNAUTHENTICATED: Refresh failed
```

## Security Headers

```mermaid
graph TD
    A[Request] --> B[Security Headers]
    B --> C[HSTS]
    B --> D[X-Frame-Options]
    B --> E[X-Content-Type-Options]
    B --> F[Content-Security-Policy]
    B --> G[CORS]
```

## Design Decisions

### Decision: JWT with Refresh Tokens

**Status**: Accepted

**Context**: Need for stateless, scalable authentication.

**Decision**: Use JWT with short-lived access tokens and refresh tokens.

**Consequences**:
- Stateless authentication
- Token rotation
- Secure logout

## Notes

- All tokens are signed with strong secret
- Refresh tokens are stored in database
- Access tokens are short-lived (15 min)
- Rate limiting is applied to auth endpoints

## References

- [JWT.io](https://jwt.io)
- [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | Security Team | Initial version |