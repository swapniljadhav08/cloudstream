# Configuration Guide

## Purpose

This document defines the configuration management strategy for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Configuration loading, feature flags, and runtime configuration.

## Audience

- DevOps Engineers
- Backend Engineers
- System Administrators

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [26_Environment_Variables.md](./26_Environment_Variables.md) - Environment variables
- [05_Tech_Stack.md](./05_Tech_Stack.md) - Technology stack

## Related Documents

- [16_Deployment.md](./16_Deployment.md) - Deployment
- [22_Microservices.md](./22_Microservices.md) - Microservices

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Development Configuration](#development-configuration)
3. [Testing Configuration](#testing-configuration)
4. [Production Configuration](#production-configuration)
5. [Feature Flags](#feature-flags)
6. [Runtime Configuration](#runtime-configuration)
7. [Configuration Loading Strategy](#configuration-loading-strategy)
8. [Design Decisions](#design-decisions)
9. [Notes](#notes)
10. [References](#references)
11. [Future Documents](#future-documents)
12. [Revision History](#revision-history)

## Configuration Overview

```mermaid
graph TD
    subgraph "Configuration Sources"
        ENV[Environment Variables]
        FLAGS[Feature Flags]
        CONFIG[Config Files]
        DB[Database Config]
    end
    
    subgraph "Configuration Layers"
        DEFAULT[Default Values]
        ENV_LAYER[Environment]
        RUNTIME[Runtime]
    end
    
    ENV --> DEFAULT
    FLAGS --> ENV_LAYER
    CONFIG --> ENV_LAYER
    DB --> RUNTIME
    
    DEFAULT --> APP[Application]
    ENV_LAYER --> APP
    RUNTIME --> APP
```

## Development Configuration

### Configuration File Structure

```typescript
// config/index.ts
export const config = {
  app: {
    name: process.env.APP_NAME || 'video-streaming-platform',
    port: parseInt(process.env.PORT) || 3001,
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE) || 10,
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
  },
  storage: {
    endpoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT) || 9000,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
    useSSL: process.env.MINIO_USE_SSL === 'true',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptCost: parseInt(process.env.BCRYPT_COST) || 12,
  },
  ffmpeg: {
    path: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    probePath: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};
```

### Development Overrides

```typescript
// config/development.ts
export const developmentConfig = {
  ...config,
  logging: {
    level: 'debug',
  },
  rateLimit: {
    windowMs: 60000,
    max: 1000, // Higher limit for development
  },
};
```

## Testing Configuration

### Test Environment

```typescript
// config/test.ts
export const testConfig = {
  app: {
    name: 'video-streaming-platform-test',
    port: 3002,
    env: 'test',
  },
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/video_test',
    poolSize: 5,
  },
  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6380',
  },
  storage: {
    endpoint: 'localhost',
    port: 9001,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    bucket: 'video-streaming-test',
    useSSL: false,
  },
  auth: {
    jwtSecret: 'test-jwt-secret-key-for-testing-only',
    jwtExpiresIn: '15m',
    refreshExpiresIn: '7d',
    bcryptCost: 4, // Lower cost for faster tests
  },
  logging: {
    level: 'error', // Reduce noise in tests
  },
};
```

### Test Database Setup

```typescript
// test/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE videos RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE users RESTART IDENTITY CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## Production Configuration

### Production Configuration

```typescript
// config/production.ts
export const productionConfig = {
  app: {
    name: 'video-streaming-platform',
    port: parseInt(process.env.PORT) || 3001,
    env: 'production',
  },
  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE) || 20,
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
  },
  storage: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKey: process.env.R2_ACCESS_KEY,
    secretKey: process.env.R2_SECRET_KEY,
    bucket: process.env.R2_BUCKET,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: '15m',
    refreshExpiresIn: '7d',
    bcryptCost: 12,
  },
  rateLimit: {
    windowMs: 60000,
    max: 100,
  },
  logging: {
    level: 'info',
  },
};
```

### Production Validation

```typescript
// config/validate.ts
export function validateProductionConfig() {
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'R2_SECRET_KEY',
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required production config: ${key}`);
    }
  }
  
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}
```

## Feature Flags

### Feature Flag Configuration

```typescript
// config/features.ts
export interface FeatureFlags {
  chunkedUpload: boolean;
  aiSubtitles: boolean;
  watermarking: boolean;
  drm: boolean;
  webhooks: boolean;
  auditLogging: boolean;
}

export const featureFlags: FeatureFlags = {
  chunkedUpload: process.env.FEATURE_CHUNKED_UPLOAD !== 'false',
  aiSubtitles: process.env.FEATURE_AI_SUBTITLES === 'true',
  watermarking: process.env.FEATURE_WATERMARKING === 'true',
  drm: process.env.FEATURE_DRM === 'true',
  webhooks: process.env.FEATURE_WEBHOOKS === 'true',
  auditLogging: process.env.FEATURE_AUDIT_LOGGING === 'true',
};
```

### Feature Flag Usage

```typescript
// guards/feature-flag.guard.ts
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.get<string>('feature', context.getHandler());
    
    if (!feature) {
      return true;
    }
    
    return featureFlags[feature as keyof FeatureFlags];
  }
}

// Usage
@Post('videos/upload')
@UseGuards(FeatureFlagGuard)
@SetFeature('chunkedUpload')
async uploadVideo() {
  // Implementation
}
```

## Runtime Configuration

### Dynamic Configuration

```typescript
// config/runtime.ts
export interface RuntimeConfig {
  maxFileSize: number;
  allowedFormats: string[];
  storageQuota: number;
  processingTimeout: number;
}

export class RuntimeConfigService {
  private config: RuntimeConfig;
  
  constructor() {
    this.loadConfig();
  }
  
  private async loadConfig() {
    // Load from database or config service
    this.config = {
      maxFileSize: 5368709120, // 5GB
      allowedFormats: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'],
      storageQuota: 10737418240, // 10GB
      processingTimeout: 3600, // 1 hour
    };
  }
  
  get(key: keyof RuntimeConfig) {
    return this.config[key];
  }
}
```

## Configuration Loading Strategy

### Configuration Factory

```typescript
// config/factory.ts
import { config } from './index';
import { developmentConfig } from './development';
import { testConfig } from './test';
import { productionConfig } from './production';

export function loadConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      validateProductionConfig();
      return productionConfig;
    case 'test':
      return testConfig;
    case 'development':
    default:
      return { ...config, ...developmentConfig };
  }
}
```

### Configuration Module

```typescript
// config/config.module.ts
@Module({
  providers: [
    {
      provide: 'CONFIG',
      useFactory: loadConfig,
    },
  ],
  exports: ['CONFIG'],
})
export class ConfigModule {}
```

## Design Decisions

### Decision: Environment-Based Configuration

**Status**: Accepted

**Context**: Need for different settings across environments.

**Decision**: Use environment-specific configuration files.

**Consequences**:
- Clear separation of concerns
- Easy to manage
- No runtime overhead

### Decision: Feature Flags

**Status**: Accepted

**Context**: Need for safe feature rollout and A/B testing.

**Decision**: Use environment variables for feature flags.

**Consequences**:
- Simple implementation
- No database queries
- Requires restart to change

## Notes

- Configuration is loaded at startup
- Feature flags can be changed without code changes
- All configuration is validated before use
- Secrets are never logged

## References

- [12-Factor App](https://12factor.net/config)
- [Feature Flags](https://featureflags.io)

## Future Documents

- [28_Coding_Guidelines.md](./28_Coding_Guidelines.md) - Coding guidelines

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | DevOps Team | Initial version |