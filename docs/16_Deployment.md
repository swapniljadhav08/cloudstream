# Deployment

## Purpose

This document defines the deployment architecture and procedures for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Deployment strategies, environment configuration, and CI/CD pipeline.

## Audience

- DevOps Engineers
- System Administrators
- Engineering Teams

## Dependencies

- [00_Project_Standards.md](./00_Project_Standards.md) - Development standards
- [04_System_Architecture.md](./04_System_Architecture.md) - System architecture
- [05_Tech_Stack.md](./05_Tech_Stack.md) - Technology stack

## Related Documents

- [06_Folder_Structure.md](./06_Folder_Structure.md) - Project structure
- [20_Logging_Monitoring.md](./20_Logging_Monitoring.md) - Monitoring
- [22_Microservices.md](./22_Microservices.md) - Microservices

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Environment Configuration](#environment-configuration)
3. [Docker Configuration](#docker-configuration)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Infrastructure as Code](#infrastructure-as-code)
6. [Scaling Strategy](#scaling-strategy)
7. [Rollback Strategy](#rollback-strategy)
8. [Health Checks](#health-checks)
9. [Design Decisions](#design-decisions)
10. [Notes](#notes)
11. [References](#references)
12. [Future Documents](#future-documents)
13. [Revision History](#revision-history)

## Deployment Overview

```mermaid
flowchart LR
    A[GitHub Push] --> B[GitHub Actions]
    B --> C[Build Images]
    C --> D[Run Tests]
    D --> E[Security Scan]
    E --> F[Deploy Staging]
    F --> G[Run E2E Tests]
    G --> H[Deploy Production]
```

## Environment Configuration

### Development

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/video_dev
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./backend:/app
      - /app/node_modules
```

### Staging

```yaml
# docker-compose.staging.yml
version: '3.8'
services:
  backend:
    image: video-streaming/backend:staging
    environment:
      - NODE_ENV=staging
      - DATABASE_URL=${STAGING_DATABASE_URL}
      - REDIS_URL=${STAGING_REDIS_URL}
```

### Production

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  backend:
    image: video-streaming/backend:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${PROD_DATABASE_URL}
      - REDIS_URL=${PROD_REDIS_URL}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

## Docker Configuration

### Backend Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/main"]
```

### Frontend Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "server.js"]
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t video-streaming/backend .
      - run: docker push video-streaming/backend

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - run: kubectl apply -f k8s/staging

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: kubectl apply -f k8s/production
```

## Infrastructure as Code

### Terraform Configuration

```hcl
module "database" {
  source = "./modules/database"
  
  instance_class = "db.t3.medium"
  allocated_storage = 100
  engine = "postgres"
  engine_version = "16"
}

module "cache" {
  source = "./modules/cache"
  
  node_type = "cache.t3.micro"
  num_cache_nodes = 1
}

module "storage" {
  source = "./modules/storage"
  
  bucket_name = "video-streaming-production"
  versioning = true
}
```

## Scaling Strategy

### Horizontal Scaling

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Worker Scaling

| Metric | Threshold | Action |
|--------|-----------|--------|
| Queue depth > 100 | Scale up | Add worker |
| Queue depth < 10 | Scale down | Remove worker |
| CPU > 80% | Scale up | Add instance |

## Rollback Strategy

### Database Rollback

```bash
# Rollback to previous migration
pnpm prisma migrate resolve --rolled-back

# Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup.sql
```

### Application Rollback

```bash
# Kubernetes rollback
kubectl rollout undo deployment/backend

# Docker rollback
docker service update --image video-streaming/backend:v1.0.0 backend
```

## Health Checks

### Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
```

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Design Decisions

### Decision: Docker-based Deployment

**Status**: Accepted

**Context**: Need for consistent, reproducible deployments.

**Decision**: Use Docker containers for all services.

**Consequences**:
- Consistent environments
- Easy scaling
- Container overhead

### Decision: GitHub Actions CI/CD

**Status**: Accepted

**Context**: Need for integrated, cost-effective CI/CD.

**Decision**: Use GitHub Actions for CI/CD pipeline.

**Consequences**:
- Integrated with GitHub
- Free tier available
- Limited concurrency

## Notes

- All deployments are automated
- Health checks are required
- Rollback procedures are documented

## References

- [Docker Documentation](https://docs.docker.com)
- [Kubernetes Documentation](https://kubernetes.io/docs)

## Future Documents

- [20_Logging_Monitoring.md](./20_Logging_Monitoring.md) - Monitoring
- [22_Microservices.md](./22_Microservices.md) - Microservices

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | DevOps Team | Initial version |