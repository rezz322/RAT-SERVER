import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApkService } from './apk.service';

@Controller('apk')
export class ApkController {
  constructor(private readonly apkService: ApkService) {}

  @Get('download')
  downloadApk(@Query('pdfId') pdfId: string, @Res() res: Response) {
    return this.apkService.sendApk(pdfId, res);
  }
}
