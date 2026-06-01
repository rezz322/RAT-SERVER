import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApkInjectorService } from './apk-injector.service';
import { PrismaService } from './prisma.service';
import { AppGateway } from './app.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ApkInjectorService, PrismaService, AppGateway],
})
export class AppModule {}
