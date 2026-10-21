import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { loadConfig } from '../../config';
import { durationToSeconds } from '../../shared/kernel/duration';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: loadConfig().JWT_SECRET,
      signOptions: { expiresIn: durationToSeconds(loadConfig().JWT_EXPIRES_IN) },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
