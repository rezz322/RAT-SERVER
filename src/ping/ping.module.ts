import { Module } from '@nestjs/common';
import { PingController } from './ping.controller';
import { PingService } from './ping.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PingController],
  providers: [PingService, PrismaService],
})
export class PingModule {}
