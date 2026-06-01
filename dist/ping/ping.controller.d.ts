import { PingService } from './ping.service';
export declare class PingController {
    private readonly pingService;
    constructor(pingService: PingService);
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
