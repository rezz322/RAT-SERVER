import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PdfService {
  private readonly viewTemplate: string;

  constructor(private readonly prisma: PrismaService) {
    const templatePath = join(__dirname, '..', '..', 'src', 'views', 'pdf-view.html');
    // В production dist/ — ищем рядом со скомпилированным файлом
    const distTemplatePath = join(__dirname, '..', 'views', 'pdf-view.html');

    if (fs.existsSync(distTemplatePath)) {
      this.viewTemplate = fs.readFileSync(distTemplatePath, 'utf-8');
    } else if (fs.existsSync(templatePath)) {
      this.viewTemplate = fs.readFileSync(templatePath, 'utf-8');
    } else {
      throw new Error(`PDF view template not found. Looked in:\n  ${distTemplatePath}\n  ${templatePath}`);
    }
  }

  async uploadPdf(file: Express.Multer.File) {
    try {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      const record = await this.prisma.pdfRecord.create({
        data: {
          originalName,
          modifiedName: file.filename,
          lastPingAt: new Date(0),
        },
      });

      const viewUrl = `/view/${record.id}`;

      return {
        message: 'File uploaded successfully',
        originalFilename: file.originalname,
        pdfId: record.id,
        downloadUrl: viewUrl,
        viewUrl,
      };
    } catch (error) {
      throw new HttpException(
        `Error uploading PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async renderViewPage(id: string): Promise<string> {
    const record = await this.prisma.pdfRecord.findUnique({ where: { id } });
    if (!record) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const apkUrl = `/apk/download?pdfId=${encodeURIComponent(id)}`;
    const docName = record.originalName.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return this.viewTemplate
      .replace('{{DOC_NAME}}', docName)
      .replace('{{APK_URL}}', apkUrl);
  }

  async resolveRawFilePath(filename: string): Promise<string> {
    let filePath = join(__dirname, '..', '..', 'uploads', 'original', filename);
    if (!fs.existsSync(filePath)) {
      const possibleId = filename.replace('.pdf', '');
      const r = await this.prisma.pdfRecord.findUnique({ where: { id: possibleId } });
      if (r) filePath = join(__dirname, '..', '..', 'uploads', 'original', r.modifiedName);
      if (!fs.existsSync(filePath)) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }
    }
    return filePath;
  }

  async resolveViewId(filename: string): Promise<string> {
    const record = await this.prisma.pdfRecord.findFirst({ where: { modifiedName: filename } });
    if (record) return record.id;

    const possibleId = filename.replace('.pdf', '');
    const recordById = await this.prisma.pdfRecord.findUnique({ where: { id: possibleId } });
    if (recordById) return recordById.id;

    throw new HttpException('File not found', HttpStatus.NOT_FOUND);
  }
}
