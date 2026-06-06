import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from './prisma.service';
import { ApkService } from './apk/apk.service';
export declare class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly prisma;
    private readonly apkService;
    static readonly activeClients: Set<string>;
    private readonly logger;
    private server;
    constructor(prisma: PrismaService, apkService: ApkService);
    afterInit(): void;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleRegister(data: {
        pdfId: string;
    }, client: Socket): Promise<void>;
}
