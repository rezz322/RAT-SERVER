import { PrismaService } from '../prisma.service';
import { ApkService } from '../apk/apk.service';
export declare class PingService {
    private readonly prisma;
    private readonly apkService;
    private readonly logger;
    constructor(prisma: PrismaService, apkService: ApkService);
    handlePing(body: any): Promise<{
        success: boolean;
    }>;
    getStatus(): Promise<{
        id: string;
        originalName: string;
        isOnline: boolean;
        lastPingAt: Date | null;
        createdAt: Date;
    }[]>;
}
