import { Module } from '@nestjs/common';
import { VideoService } from './application/video.service';
import { VideoRepository } from './infrastructure/video.repository';
import { VideoController } from './presentation/video.controller';

@Module({
  controllers: [VideoController],
  providers: [VideoService, VideoRepository],
  exports: [VideoService],
})
export class VideoModule {}
