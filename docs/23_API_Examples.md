# API Examples

## Purpose

This document provides practical API usage examples for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Code examples, SDK usage, and integration patterns.

## Audience

- Frontend Engineers
- API Consumers
- Integration Developers

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [05_Tech_Stack.md](./05_Tech_Stack.md) - Technology stack
- [08_API_Design.md](./08_API_Design.md) - API design

## Related Documents

- [08_API_Design.md](./08_API_Design.md) - API design
- [24_UI_UX.md](./24_UI_UX.md) - UI/UX

## Table of Contents

1. [Authentication Examples](#authentication-examples)
2. [Video Examples](#video-examples)
3. [User Examples](#user-examples)
4. [Admin Examples](#admin-examples)
5. [SDK Examples](#sdk-examples)
6. [Error Handling Examples](#error-handling-examples)
7. [Design Decisions](#design-decisions)
8. [Notes](#notes)
9. [References](#references)
10. [Future Documents](#future-documents)
11. [Revision History](#revision-history)

## Authentication Examples

### Register User

```bash
curl -X POST https://api.videostreaming.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

```javascript
// JavaScript
const response = await fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    name: 'John Doe',
  }),
});
```

### Login

```bash
curl -X POST https://api.videostreaming.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

```typescript
// TypeScript with Axios
const { data } = await axios.post('/api/v1/auth/login', {
  email: 'user@example.com',
  password: 'SecurePass123!',
});

// Store tokens
localStorage.setItem('accessToken', data.data.accessToken);
```

## Video Examples

### Upload Video

```bash
curl -X POST https://api.videostreaming.com/api/v1/videos \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@video.mp4" \
  -F "title=My Video" \
  -F "description=Video description"
```

```typescript
// React with TanStack Query
const uploadMutation = useMutation({
  mutationFn: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    
    return axios.post('/api/v1/videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
});
```

### List Videos

```bash
curl -X GET "https://api.videostreaming.com/api/v1/videos?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

```typescript
// React with TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['videos', page, limit],
  queryFn: () => api.getVideos({ page, limit }),
});
```

### Get Video

```bash
curl -X GET https://api.videostreaming.com/api/v1/videos/video_abc123 \
  -H "Authorization: Bearer $TOKEN"
```

```typescript
// Get video with React Query
const { data: video } = useQuery({
  queryKey: ['video', videoId],
  queryFn: () => api.getVideo(videoId),
});
```

## User Examples

### Get Profile

```bash
curl -X GET https://api.videostreaming.com/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

```typescript
// Get user profile
const { data: user } = useQuery({
  queryKey: ['profile'],
  queryFn: () => api.getProfile(),
});
```

### Update Profile

```bash
curl -X PATCH https://api.videostreaming.com/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Smith"}'
```

## Admin Examples

### Get System Stats

```bash
curl -X GET https://api.videostreaming.com/api/v1/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

```typescript
// Get admin stats
const { data: stats } = useQuery({
  queryKey: ['admin-stats'],
  queryFn: () => api.getAdminStats(),
  enabled: user?.role === 'ADMIN',
});
```

## SDK Examples

### TypeScript SDK

```typescript
// api/client.ts
import axios from 'axios';

class VideoStreamingClient {
  private client = axios.create({
    baseURL: 'https://api.videostreaming.com/api/v1',
  });

  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    this.setToken(data.data.accessToken);
    return data;
  }

  async uploadVideo(file: File, title: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    
    return this.client.post('/videos', formData);
  }

  private setToken(token: string) {
    this.client.defaults.headers.Authorization = `Bearer ${token}`;
  }
}
```

### React Hooks

```typescript
// hooks/useVideos.ts
export function useVideos() {
  return useQuery({
    queryKey: ['videos'],
    queryFn: () => api.getVideos(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUploadVideo() {
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title: string }) =>
      api.uploadVideo(file, title),
    onSuccess: () => queryClient.invalidateQueries(['videos']),
  });
}
```

## Error Handling Examples

### Handle API Errors

```typescript
// Global error handler
const { data, error } = useQuery({
  queryKey: ['video', videoId],
  queryFn: () => api.getVideo(videoId),
  onError: (error: ApiError) => {
    switch (error.code) {
      case 'NOT_FOUND':
        router.push('/404');
        break;
      case 'AUTHENTICATION_ERROR':
        router.push('/login');
        break;
      default:
        toast.error(error.message);
    }
  },
});
```

### Retry Logic

```typescript
// Retry failed requests
const { data } = useQuery({
  queryKey: ['video', videoId],
  queryFn: () => api.getVideo(videoId),
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
});
```

## Design Decisions

### Decision: REST API

**Status**: Accepted

**Context**: Need for standard, language-agnostic API.

**Decision**: Use RESTful API with JSON responses.

**Consequences**:
- Easy to integrate
- Standard tooling
- No real-time updates

### Decision: Axios for SDK

**Status**: Accepted

**Context**: Need for reliable HTTP client.

**Decision**: Use Axios for API client.

**Consequences**:
- Interceptors for auth
- Request/response transforms
- Good TypeScript support

## Notes

- All examples use the production API
- SDK is auto-generated from OpenAPI spec
- Error codes are stable

## References

- [OpenAPI Generator](https://openapi-generator.tech)

## Future Documents

- [24_UI_UX.md](./24_UI_UX.md) - UI/UX

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | API Team | Initial version |