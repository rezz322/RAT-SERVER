import { Module } from '@nestjs/common';
import { PingController } from './ping.controller';
import { PingService } from './ping.service';
import { PrismaService } from '../prisma.service';
import { ApkModule } from '../apk/apk.module';

@Module({
  imports: [ApkModule],
  controllers: [PingController],
  providers: [PingService, PrismaService],
})
export class PingModule {}
