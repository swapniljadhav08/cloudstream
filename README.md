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
- Docker, Docker Compose
- Prometheus, Grafana, Loki

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/video-streaming-platform.git
cd video-streaming-platform

# Start development environment
docker-compose up -d

# Install dependencies
pnpm install

# Run migrations
pnpm prisma migrate dev

# Start development servers
pnpm dev
```

## Project Structure

```
video-streaming-platform/
├── docs/                    # Project documentation
│   ├── diagrams/         # Architecture diagrams
│   ├── assets/           # Documentation assets
│   └── *.md              # Documentation files
├── frontend/             # Next.js frontend application
├── backend/              # NestJS backend application
├── infrastructure/       # Docker, Kubernetes, CI/CD
└── README.md
```

## Development Phases

### Phase 1: Foundation (Complete)
- ✅ Core transcoding pipeline
- ✅ User authentication and RBAC
- ✅ Basic video library
- ✅ HLS streaming support

### Phase 2: Scale
- Chunked upload for large files
- Advanced analytics dashboard
- Webhook notifications
- Performance optimization

### Phase 3: Enterprise
- Audit logging
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