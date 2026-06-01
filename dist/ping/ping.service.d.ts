import { PrismaService } from '../prisma.service';
export declare class PingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
