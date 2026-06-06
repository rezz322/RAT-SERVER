import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma.service';
import { ApkModule } from '../apk/apk.module';

@Module({
  imports: [ApkModule],
  controllers: [PdfController],
  providers: [PdfService, PrismaService],
})
export class PdfModule {}
