import type { Response } from 'express';
import { ApkService } from './apk.service';
export declare class ApkController {
    private readonly apkService;
    constructor(apkService: ApkService);
    downloadApk(pdfId: string, res: Response): void | Response<any, Record<string, any>>;
}
