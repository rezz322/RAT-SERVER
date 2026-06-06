import { PrismaService } from '../prisma.service';
import { ApkService } from '../apk/apk.service';
export declare class PdfService {
    private readonly prisma;
    private readonly apkService;
    private readonly viewTemplate;
    constructor(prisma: PrismaService, apkService: ApkService);
    uploadPdf(file: Express.Multer.File): Promise<{
        message: string;
        originalFilename: string;
        pdfId: string;
        viewUrl: string;
    }>;
    renderViewPage(id: string): Promise<string>;
    getApkFilePath(id: string): Promise<string>;
    resolveRawFilePath(filename: string): Promise<string>;
    resolveViewId(filename: string): Promise<string>;
}
