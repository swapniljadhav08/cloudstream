# Automated Cloud-Native Video Transcoding and Streaming Platform

> Enterprise-grade video processing platform with automated transcoding, adaptive streaming, and cloud-native architecture.

## Overview

This platform provides a complete solution for video content management, including:

- **Automated Transcoding**: Upload any video format, get HLS adaptive streaming
- **Multi-resolution Output**: 240p, 360p, 480p, 720p, 1080p, 4K
- **Enterprise Security**: RBAC, JWT authentication, audit trails
- **Real-time Monitoring**: Prometheus metrics, Grafana dashboards
- **Developer APIs**: RESTful API with comprehensive documentation

## Documentation

All project documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [00_Project_Standards.md](./docs/00_Project_Standards.md) | Coding standards, architecture principles, and development conventions |
| [01_Project_Vision.md](./docs/01_Project_Vision.md) | Product vision, mission, and strategic direction |
| [02_Requirements.md](./docs/02_Requirements.md) | Functional and non-functional requirements |
| [03_PRD.md](./docs/03_PRD.md) | Product requirements and feature specifications |
| [04_System_Architecture.md](./docs/04_System_Architecture.md) | System architecture and component design |
| [05_Tech_Stack.md](./docs/05_Tech_Stack.md) | Technology stack and justifications |

## Technology Stack

### Frontend
- React 19, Next.js 15, TypeScript
- Tailwind CSS, shadcn/ui, Radix UI
- Video.js, TanStack Query, Zustand

### Backend
- Node.js 22 LTS, NestJS, Fastify
- Prisma ORM, JWT, Passport.js
- BullMQ, FFmpeg, MinIO

### Infrastructure
- PostgreSQL 16, Redis 7
- Docker, Terraform (infrastructure as code)
- Prometheus, Grafana, Loki

## Quick Start

Requires Docker, Terraform >= 1.6 and Node >= 22. No local ffmpeg needed: the
worker is containerised and brings its own.

```bash
# 1. Provision infrastructure (PostgreSQL, Redis, S3-compatible storage,
#    bucket layout, access policy, CORS). Also writes .env, .env.docker and
#    frontend/.env.local from its outputs.
cd infrastructure/terraform/environments/local
terraform init && terraform apply
cd -

# 2. Install dependencies and apply the schema
npm install
npm run -w backend db:migrate
npm run -w backend db:seed      # admin@example.com / creator@example.com

# 3. Start the services (each in its own terminal)
npm run dev:backend             # API on :3001
npm run dev:frontend            # UI  on :3000

# 4. Start the transcoding worker
npm run worker:build
npm run worker:up               # logs: npm run worker:logs
```

Then open http://localhost:3000 and sign in as `creator@example.com` /
`CreatorPass123!`.

Tear the stack down with `npm run infra:down`.

### Verifying

```bash
npm test          # unit tests for the ladder, playlists, tokens, upload policy
npm run test:e2e  # end-to-end: upload -> transcode -> adaptive playback
```

## Infrastructure as Code

Terraform owns all infrastructure; there is no docker-compose file. The same
configuration targets local and cloud:

| Path | Purpose |
|------|---------|
| `modules/platform-contract` | Bucket layout, lifecycle rules and the ABR ladder, declared once |
| `modules/storage-s3` | S3 bucket, access policy, CORS, lifecycle. Applied unchanged against LocalStack and real AWS |
| `modules/local-stack` | PostgreSQL, Redis and LocalStack containers standing in for RDS, ElastiCache and S3 |
| `modules/aws-stack` | RDS PostgreSQL, ElastiCache Redis, S3 |
| `modules/oci-stack` | OCI PostgreSQL, OCI Cache, OCI Object Storage via its S3-compatible API |
| `environments/{local,aws,oci}` | Thin roots; every stack exposes the same outputs |

Because all three stacks expose the same output surface, moving to a cloud
provider is `cd environments/aws && terraform apply` plus rendering the
application config from `terraform output -json app_config`.

## Development Phases

### Phase 1: Foundation (Complete)
- ✅ Core transcoding pipeline
- ✅ User authentication and RBAC
- ✅ Basic video library
- ✅ HLS streaming support

### Phase 2: Scale
- Chunked/resumable upload for very large files
- Advanced analytics dashboard
- Webhook notifications
- Performance optimization

### Phase 3: Enterprise
- ☑ Audit logging
- Custom transcoding profiles
- API rate limiting
- Advanced security features

### Phase 4: Innovation
- AI subtitle generation
- Watermarking support
- DRM integration
- Kubernetes deployment

## Contributing

Please read the [Project Standards](./docs/00_Project_Standards.md) before contributing.

## License

MIT License - See LICENSE file for details.