export declare class AppService {
    getHello(): string;
    processPdf(originalPath: string, filename: string, pdfId: string): Promise<string>;
}
