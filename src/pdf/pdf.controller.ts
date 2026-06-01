import {
  Controller,
  Get,
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
  Query,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Response } from 'express';
import * as fs from 'fs';
import { PdfService } from './pdf.service';

@Controller()
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('pdf/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(__dirname, '..', '..', 'uploads', 'original');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(
            new HttpException('Only PDF files are allowed!', HttpStatus.BAD_REQUEST),
            false,
          );
        }
      },
    }),
  )
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }
    return this.pdfService.uploadPdf(file);
  }

  @Get('view/:id')
  async viewPdf(@Param('id') id: string, @Res() res: Response) {
    const html = await this.pdfService.renderViewPage(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Get('pdf/raw/:filename')
  async downloadPdfRaw(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = await this.pdfService.resolveRawFilePath(filename);
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(filePath);
  }

  @Get('pdf/:filename')
  async downloadPdf(
    @Param('filename') filename: string,
    @Query('pdfId') pdfIdQuery: string,
    @Res() res: Response,
  ) {
    const id = await this.pdfService.resolveViewId(filename);
    return res.redirect(`/view/${id}`);
  }

  @Get('pdf/download/:id')
  async downloadPdfById(@Param('id') id: string, @Res() res: Response) {
    return res.redirect(`/view/${id}`);
  }
}
