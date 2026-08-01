# API Design

## Purpose

This document defines the complete REST API design for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

All API endpoints, request/response schemas, and error handling.

## Audience

- Backend Engineers
- Frontend Engineers
- API Consumers
- QA Engineers

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [02_Requirements.md](./02_Requirements.md) - System requirements
- [03_PRD.md](./03_PRD.md) - Product requirements
- [07_Database_Schema.md](./07_Database_Schema.md) - Database schema

## Related Documents

- [09_Authentication.md](./09_Authentication.md) - Authentication
- [23_API_Examples.md](./23_API_Examples.md) - API examples
- [19_Error_Handling.md](./19_Error_Handling.md) - Error handling

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Video Endpoints](#video-endpoints)
4. [User Endpoints](#user-endpoints)
5. [Admin Endpoints](#admin-endpoints)
6. [Request/Response Schemas](#requestresponse-schemas)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Versioning](#versioning)
10. [Design Decisions](#design-decisions)
11. [Notes](#notes)
12. [References](#references)
13. [Future Documents](#future-documents)
14. [Revision History](#revision-history)

## API Overview

### Base URL

```
https://api.videostreaming.com/api/v1
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes (protected) | Bearer {token} |
| Content-Type | Yes | application/json |
| X-Request-ID | No | Request tracing |

### Response Format

```typescript
// Success
{
  "data": T,
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [...]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

## Authentication Endpoints

### Register User

```
POST /auth/register
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response**: `201 Created`
```json
{
  "data": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Login

```
POST /auth/login
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response**: `200 OK`
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "rt_abc123...",
    "expiresIn": 900
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Refresh Token

```
POST /auth/refresh
```

**Request Body**:
```json
{
  "refreshToken": "rt_abc123..."
}
```

**Response**: `200 OK`
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Logout

```
POST /auth/logout
```

**Response**: `204 No Content`

## Video Endpoints

### List Videos

```
GET /videos
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| status | string | Filter by status |
| search | string | Full-text search |

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "video_abc123",
      "title": "My Video",
      "status": "COMPLETED",
      "duration": 120,
      "fileSize": 52428800,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Upload Video

```
POST /videos
```

**Request**: `multipart/form-data`
| Field | Type | Required |
|-------|------|----------|
| file | File | Yes |
| title | string | Yes |
| description | string | No |

**Response**: `201 Created`
```json
{
  "data": {
    "id": "video_abc123",
    "title": "My Video",
    "status": "PENDING",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Get Video

```
GET /videos/{id}
```

**Response**: `200 OK`
```json
{
  "data": {
    "id": "video_abc123",
    "title": "My Video",
    "description": "Video description",
    "status": "COMPLETED",
    "duration": 120,
    "fileSize": 52428800,
    "resolutions": [
      {
        "resolution": "720p",
        "url": "https://cdn.example.com/video_abc123/720p/master.m3u8",
        "bitrate": 2400,
        "width": 1280,
        "height": 720
      }
    ],
    "thumbnails": [
      {
        "url": "https://cdn.example.com/video_abc123/thumbnails/10s.jpg",
        "timestamp": 10
      }
    ],
    "metadata": {
      "width": 1920,
      "height": 1080,
      "codec": "h264"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Update Video

```
PATCH /videos/{id}
```

**Request Body**:
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "isPublic": true
}
```

**Response**: `200 OK`

### Delete Video

```
DELETE /videos/{id}
```

**Response**: `204 No Content`

### Get Processing Status

```
GET /videos/{id}/status
```

**Response**: `200 OK`
```json
{
  "data": {
    "status": "PROCESSING",
    "progress": 45,
    "currentStep": "transcoding_720p"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

## User Endpoints

### Get Profile

```
GET /users/profile
```

**Response**: `200 OK`
```json
{
  "data": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://cdn.example.com/avatar.jpg",
    "storageUsed": 52428800,
    "storageQuota": 10737418240
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Update Profile

```
PATCH /users/profile
```

**Request Body**:
```json
{
  "name": "John Smith",
  "avatar": "file"
}
```

**Response**: `200 OK`

## Admin Endpoints

### List Users

```
GET /admin/users
```

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "user_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "storageUsed": 52428800,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Get System Stats

```
GET /admin/stats
```

**Response**: `200 OK`
```json
{
  "data": {
    "totalUsers": 1000,
    "totalVideos": 5000,
    "processingJobs": {
      "pending": 10,
      "processing": 50,
      "failed": 2
    },
    "storage": {
      "used": 536870912000,
      "total": 1073741824000
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

## Request/Response Schemas

### Video Schema

```typescript
interface Video {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  originalUrl: string;
  duration?: number;
  fileSize: number;
  mimeType: string;
  metadata?: VideoMetadata;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VideoMetadata {
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  audioCodec: string;
  audioBitrate: number;
}
```

### User Schema

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  avatarUrl?: string;
  storageUsed: number;
  storageQuota: number;
  createdAt: string;
  updatedAt: string;
}
```

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| AUTHENTICATION_ERROR | 401 | Missing or invalid token |
| AUTHORIZATION_ERROR | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate resource |
| RATE_LIMIT | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| /auth/* | 10 | 1 minute |
| /videos (upload) | 100 | 1 minute |
| /videos/* | 1000 | 1 minute |
| /admin/* | 500 | 1 minute |

## Versioning

API versioning is done through URL path: `/api/v1/`

Future versions will be: `/api/v2/`

## Design Decisions

### Decision: RESTful API

**Status**: Accepted

**Context**: Need for standard, predictable API design.

**Decision**: Use RESTful conventions with plural nouns.

**Consequences**:
- Standard HTTP methods
- Predictable endpoints
- Easy to document

### Decision: JWT Authentication

**Status**: Accepted

**Context**: Stateless authentication required for scalability.

**Decision**: Use JWT with short-lived access tokens.

**Consequences**:
- Stateless authentication
- Token refresh required
- No server-side session storage

## Notes

- All endpoints are documented in OpenAPI 3.0
- API is versioned at the path level
- Rate limiting is enforced per user

## References

- [OpenAPI Specification](https://swagger.io/specification/)
- [JWT.io](https://jwt.io)

## Future Documents

- [23_API_Examples.md](./23_API_Examples.md) - API usage examples
- [19_Error_Handling.md](./19_Error_Handling.md) - Error handling details

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | API Team | Initial version |