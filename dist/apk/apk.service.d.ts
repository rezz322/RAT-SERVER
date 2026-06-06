import { ApkInjectorService } from './apk-injector.service';
export declare class ApkService {
    private readonly apkInjector;
    private readonly logger;
    private readonly apksignerPath;
    private javaHome;
    private buildQueue;
    constructor(apkInjector: ApkInjectorService);
    private ensureKeystore;
    getApkPath(originalName: string): string;
    enqueueApkBuild(pdfId: string, pdfFilePath: string, originalName: string): void;
    private runBuildPipeline;
    deleteApk(pdfId: string, originalName: string): void;
}
