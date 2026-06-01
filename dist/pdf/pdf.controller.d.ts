import type { Response } from 'express';
import { PdfService } from './pdf.service';
export declare class PdfController {
    private readonly pdfService;
    constructor(pdfService: PdfService);
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
}
