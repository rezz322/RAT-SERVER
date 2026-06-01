import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from './prisma.service';
export declare class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly prisma;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleRegister(data: {
        pdfId: string;
    }, client: Socket): Promise<void>;
}
