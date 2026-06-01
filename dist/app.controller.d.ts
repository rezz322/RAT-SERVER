import { AppService } from './app.service';
import { ApkInjectorService } from './apk-injector.service';
import { PrismaService } from './prisma.service';
import type { Response } from 'express';
export declare class AppController {
    private readonly appService;
    private readonly apkInjector;
    private readonly prisma;
    constructor(appService: AppService, apkInjector: ApkInjectorService, prisma: PrismaService);
    getHello(): string;
    uploadPdf(file: Express.Multer.File): Promise<{
        message: string;
        originalFilename: string;
        pdfId: string;
        downloadUrl: string;
        viewUrl: string;
    }>;
    viewPdf(id: string, res: Response): Promise<Response<any, Record<string, any>>>;
    downloadPdfRaw(filename: string, res: Response): Promise<void>;
    downloadPdf(filename: string, pdfIdQuery: string, res: Response): Promise<void>;
    downloadPdfById(id: string, res: Response): Promise<void>;
    downloadApk(pdfId: string, res: Response): void | Response<any, Record<string, any>>;
    ping(body: any, req: any): Promise<{
        success: boolean;
    }>;
    status(): Promise<{
        id: string;
        originalName: string;
        isOnline: boolean;
        lastPingAt: Date | null;
        createdAt: Date;
    }[]>;
}
