# Environment Variables

## Purpose

This document defines the complete environment variable configuration for the Automated Cloud-Native Video Transcoding and Streaming Platform, including development, production, and secret management.

## Scope

All environment variables, their values, validation rules, and security considerations.

## Audience

- DevOps Engineers
- Backend Engineers
- System Administrators

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [05_Tech_Stack.md](./05_Tech_Stack.md) - Technology stack
- [16_Deployment.md](./16_Deployment.md) - Deployment configuration

## Related Documents

- [27_Configuration_Guide.md](./27_Configuration_Guide.md) - Configuration guide
- [17_Security.md](./17_Security.md) - Security architecture

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Development Variables](#development-variables)
3. [Production Variables](#production-variables)
4. [Secret Management](#secret-management)
5. [Example .env Structure](#example-env-structure)
6. [Validation Rules](#validation-rules)
7. [Design Decisions](#design-decisions)
8. [Notes](#notes)
9. [References](#references)
10. [Future Documents](#future-documents)
11. [Revision History](#revision-history)

## Environment Overview

```mermaid
graph TD
    subgraph "Environment Configuration"
        DEV[Development]
        STAGING[Staging]
        PROD[Production]
    end
    
    subgraph "Configuration Sources"
        ENV[.env files]
        SECRETS[Secret Manager]
        K8S[Kubernetes Secrets]
    end
    
    DEV --> ENV
    STAGING --> SECRETS
    PROD --> K8S
```

## Development Variables

### Application Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode |
| `PORT` | No | `3001` | Backend server port |
| `APP_NAME` | No | `video-streaming-platform` | Application name |
| `APP_URL` | Yes | `http://localhost:3000` | Frontend URL |
| `API_URL` | Yes | `http://localhost:3001` | Backend API URL |

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DATABASE_POOL_SIZE` | No | `10` | Connection pool size |

### Redis Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection string |
| `REDIS_PASSWORD` | No | - | Redis password |

### Storage Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIO_ENDPOINT` | Yes | `localhost` | MinIO endpoint |
| `MINIO_PORT` | No | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | Yes | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | Yes | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | Yes | `video-streaming` | MinIO bucket name |
| `MINIO_USE_SSL` | No | `false` | Use SSL for MinIO |

### Authentication Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | JWT signing secret (32+ chars) |
| `JWT_EXPIRES_IN` | No | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiry |
| `BCRYPT_COST` | No | `12` | Password hashing cost |

### FFmpeg Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FFMPEG_PATH` | No | `/usr/bin/ffmpeg` | FFmpeg binary path |
| `FFPROBE_PATH` | No | `/usr/bin/ffprobe` | FFprobe binary path |

### Email Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | - | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASSWORD` | No | - | SMTP password |
| `EMAIL_FROM` | No | `noreply@videostreaming.com` | From email address |

## Production Variables

### Application Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | No | Backend server port |
| `APP_NAME` | No | Application name |
| `APP_URL` | Yes | Production frontend URL |
| `API_URL` | Yes | Production backend URL |

### Database Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (SSL required) |
| `DATABASE_POOL_SIZE` | No | Connection pool size |

### Redis Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | Yes | Redis connection string (TLS required) |
| `REDIS_PASSWORD` | Yes | Redis password |

### Storage Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2 account ID |
| `R2_ACCESS_KEY` | Yes | R2 access key |
| `R2_SECRET_KEY` | Yes | R2 secret key |
| `R2_BUCKET` | Yes | R2 bucket name |
| `R2_ENDPOINT` | No | R2 endpoint (auto-detected) |

### Authentication Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Strong JWT signing secret (256-bit) |
| `JWT_EXPIRES_IN` | No | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token expiry |
| `BCRYPT_COST` | No | Password hashing cost |

### Monitoring Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `LOG_LEVEL` | No | `info` (production default) |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `PROMETHEUS_URL` | No | Prometheus endpoint |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |

## Secret Management

### Development Secrets

```bash
# .env.local (git-ignored)
JWT_SECRET=dev-secret-key-do-not-use-in-production
MINIO_SECRET_KEY=minioadmin
SMTP_PASSWORD=dev-password
```

### Production Secrets

#### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: video-streaming-secrets
type: Opaque
data:
  JWT_SECRET: <base64-encoded>
  R2_SECRET_KEY: <base64-encoded>
  SMTP_PASSWORD: <base64-encoded>
```

#### Docker Secrets

```bash
# Using Docker secrets
docker secret create jwt_secret ./secrets/jwt_secret.txt
docker secret create r2_secret_key ./secrets/r2_secret_key.txt
```

#### Environment Variable Validation

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

## Example .env Structure

### .env.example

```bash
# Application
NODE_ENV=development
PORT=3001
APP_NAME=video-streaming-platform
APP_URL=http://localhost:3000
API_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/video_dev
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=video-streaming
MINIO_USE_SSL=false

# JWT
JWT_SECRET=your-secret-key-here-min-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_COST=12

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@videostreaming.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
```

### .env.development

```bash
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3000
API_URL=http://localhost:3001

DATABASE_URL=postgresql://postgres:password@postgres:5432/video_dev
REDIS_URL=redis://redis:6379

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=video-streaming

JWT_SECRET=dev-secret-key-for-local-development-only
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

LOG_LEVEL=debug
```

### .env.production

```bash
NODE_ENV=production
PORT=3001
APP_URL=https://app.videostreaming.com
API_URL=https://api.videostreaming.com

DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}

R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
R2_ACCESS_KEY=${R2_ACCESS_KEY}
R2_SECRET_KEY=${R2_SECRET_KEY}
R2_BUCKET=video-streaming-production

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

LOG_LEVEL=info
```

## Validation Rules

### Required Variables

| Environment | Required Variables |
|-------------|-------------------|
| Development | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` |
| Production | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `R2_SECRET_KEY` |

### Validation Schema

```typescript
const envValidation = {
  NODE_ENV: {
    required: true,
    values: ['development', 'staging', 'production'],
  },
  PORT: {
    required: false,
    type: 'number',
    min: 1024,
    max: 65535,
  },
  DATABASE_URL: {
    required: true,
    type: 'url',
  },
  REDIS_URL: {
    required: true,
    type: 'url',
  },
  JWT_SECRET: {
    required: true,
    type: 'string',
    minLength: 32,
  },
  JWT_EXPIRES_IN: {
    required: false,
    type: 'string',
    pattern: /^(\d+[smhd])+$/,
  },
  MINIO_SECRET_KEY: {
    required: process.env.NODE_ENV !== 'production',
    type: 'string',
    minLength: 8,
  },
  R2_SECRET_KEY: {
    required: process.env.NODE_ENV === 'production',
    type: 'string',
  },
};
```

### Runtime Validation

```typescript
// Validate on application startup
function validateEnvironment() {
  const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}
```

## Design Decisions

### Decision: .env Files for Development

**Status**: Accepted

**Context**: Need for simple, local configuration during development.

**Decision**: Use .env files with .env.example for documentation.

**Consequences**:
- Easy local setup
- Clear documentation
- Secrets must be git-ignored

### Decision: Kubernetes Secrets for Production

**Status**: Accepted

**Context**: Need for secure, scalable secret management in production.

**Decision**: Use Kubernetes Secrets with external secret operators.

**Consequences**:
- Secure secret storage
- Integration with cloud providers
- Additional infrastructure complexity

### Decision: Zod for Validation

**Status**: Accepted

**Context**: Need for type-safe, runtime environment validation.

**Decision**: Use Zod schema for environment variable validation.

**Consequences**:
- Type safety
- Clear error messages
- Validation at startup

## Notes

- All .env files are git-ignored except .env.example
- Secrets should never be committed to version control
- Environment variables are validated at application startup
- Use strong, unique secrets for production

## References

- [12-Factor App](https://12factor.net/config)
- [Zod Documentation](https://zod.dev)

## Future Documents

- [27_Configuration_Guide.md](./27_Configuration_Guide.md) - Configuration guide

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | DevOps Team | Initial version |