import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway';
import { PrismaService } from './prisma.service';
import { PdfModule } from './pdf/pdf.module';
import { ApkModule } from './apk/apk.module';
import { PingModule } from './ping/ping.module';

@Module({
  imports: [PdfModule, ApkModule, PingModule],
  controllers: [AppController],
  providers: [AppService, AppGateway, PrismaService],
})
export class AppModule {}
