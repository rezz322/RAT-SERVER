import type { Response } from 'express';
import { ApkInjectorService } from '../apk-injector.service';
export declare class ApkService {
    private readonly apkInjector;
    constructor(apkInjector: ApkInjectorService);
    sendApk(pdfId: string, res: Response): void | Response<any, Record<string, any>>;
}
