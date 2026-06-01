import { PrismaService } from '../prisma.service';
export declare class PdfService {
    private readonly prisma;
    private readonly viewTemplate;
    constructor(prisma: PrismaService);
    uploadPdf(file: Express.Multer.File): Promise<{
        message: string;
        originalFilename: string;
        pdfId: string;
        downloadUrl: string;
        viewUrl: string;
    }>;
    renderViewPage(id: string): Promise<string>;
    resolveRawFilePath(filename: string): Promise<string>;
    resolveViewId(filename: string): Promise<string>;
}
