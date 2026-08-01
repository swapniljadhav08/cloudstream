# Deployment Diagram

## Purpose

This document defines the deployment architecture for the Automated Cloud-Native Video Transcoding and Streaming Platform.

## Scope

Infrastructure, containers, and deployment configurations.

## Audience

- DevOps Engineers
- System Administrators
- Engineering Teams

## Dependencies

- [00_Project_Standards.md](../00_Project_Standards.md) - Development standards
- [16_Deployment.md](../16_Deployment.md) - Deployment
- [05_Tech_Stack.md](../05_Tech_Stack.md) - Technology stack

## Related Documents

- [High_Level_Architecture.md](./High_Level_Architecture.md) - Architecture
- [Storage_Flow.md](./Storage_Flow.md) - Storage

## Deployment Diagram

```mermaid
graph TD
    subgraph "Load Balancer"
        LB[Cloudflare/CDN]
    end
    
    subgraph "Kubernetes Cluster"
        subgraph "Frontend"
            FE1[Frontend Pod 1]
            FE2[Frontend Pod 2]
        end
        
        subgraph "Backend"
            BE1[Backend Pod 1]
            BE2[Backend Pod 2]
        end
        
        subgraph "Workers"
            W1[Worker Pod 1]
            W2[Worker Pod 2]
        end
        
        subgraph "Infrastructure"
            DB[(PostgreSQL)]
            CACHE[(Redis)]
            STORAGE[Cloudflare R2]
        end
    end
    
    LB --> FE1
    LB --> FE2
    FE1 --> BE1
    FE2 --> BE2
    BE1 --> DB
    BE1 --> CACHE
    BE1 --> STORAGE
    BE2 --> DB
    BE2 --> CACHE
    BE2 --> STORAGE
    W1 --> STORAGE
    W2 --> STORAGE
```

## Development Environment

```mermaid
graph TD
    subgraph "Docker Compose"
        FRONTEND_DEV[Frontend<br/>:3000]
        BACKEND_DEV[Backend<br/>:3001]
        POSTGRES_DEV[(PostgreSQL<br/>:5432)]
        REDIS_DEV[(Redis<br/>:6379)]
        MINIO_DEV[MinIO<br/>:9000]
        NGINX_DEV[NGINX<br/>:80]
    end
    
    FRONTEND_DEV --> BACKEND_DEV
    BACKEND_DEV --> POSTGRES_DEV
    BACKEND_DEV --> REDIS_DEV
    BACKEND_DEV --> MINIO_DEV
    NGINX_DEV --> FRONTEND_DEV
    NGINX_DEV --> BACKEND_DEV
```

## Container Architecture

```mermaid
graph TD
    subgraph "Multi-stage Build"
        BASE[Base Image<br/>node:22-alpine]
        DEPS[Install Dependencies]
        BUILD[Build Application]
        RUNTIME[Runtime Image<br/>node:22-alpine]
    end
    
    BASE --> DEPS
    DEPS --> BUILD
    BUILD --> RUNTIME
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    spec:
      containers:
      - name: backend
        image: video-streaming/backend:latest
        ports:
        - containerPort: 3001
        envFrom:
        - secretRef:
            name: video-streaming-secrets
        resources:
          limits:
            cpu: '2'
            memory: '4G'
```

## Service Configuration

```mermaid
graph TD
    subgraph "Services"
        FRONTEND_SVC[Frontend Service]
        BACKEND_SVC[Backend Service]
        WORKER_SVC[Worker Service]
    end
    
    subgraph "External"
        DB_SVC[PostgreSQL Service]
        CACHE_SVC[Redis Service]
        STORAGE_SVC[MinIO/R2 Service]
    end
    
    FRONTEND_SVC --> BACKEND_SVC
    BACKEND_SVC --> DB_SVC
    BACKEND_SVC --> CACHE_SVC
    BACKEND_SVC --> STORAGE_SVC
    WORKER_SVC --> CACHE_SVC
    WORKER_SVC --> STORAGE_SVC
```

## CI/CD Pipeline

```mermaid
flowchart LR
    A[GitHub Push] --> B[GitHub Actions]
    B --> C[Run Tests]
    C --> D[Build Images]
    D --> E[Security Scan]
    E --> F[Deploy Staging]
    F --> G[Run E2E Tests]
    G --> H[Deploy Production]
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

### Decision: Kubernetes for Production

**Status**: Accepted

**Context**: Need for production orchestration.

**Decision**: Use Kubernetes for production deployment.

**Consequences**:
- Auto-scaling
- Self-healing
- Complex setup

## Notes

- All deployments are automated
- Health checks are required
- Rollback procedures are documented
- Monitoring is integrated

## References

- [Docker Documentation](https://docs.docker.com)
- [Kubernetes Documentation](https://kubernetes.io/docs)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-15 | 1.0.0 | DevOps Team | Initial version |