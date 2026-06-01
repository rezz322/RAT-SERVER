"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("./prisma.service");
const WS_PORT = parseInt(process.env.WS_PORT || process.env.PORT || '8080');
const WS_CORS_ORIGIN = process.env.BASE_URL || '*';
let AppGateway = class AppGateway {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    handleConnection(client) {
        console.log(`[WebSocket] Client connected: ${client.id}`);
        client.onAny((eventName, ...args) => {
            if (eventName !== 'register') {
                console.log(`[WebSocket] Data from client ${client.id} (event: '${eventName}'):`, args);
            }
        });
    }
    handleDisconnect(client) {
        console.log(`[WebSocket] Client disconnected: ${client.id}`);
    }
    async handleRegister(data, client) {
        if (!data || !data.pdfId) {
            console.log(`[WebSocket] Client ${client.id} sent invalid register payload`);
            return;
        }
        try {
            const record = await this.prisma.pdfRecord.update({
                where: { id: data.pdfId },
                data: { lastPingAt: new Date() },
            });
            console.log(`[WebSocket] Client ${client.id} registered for PDF: ${record.originalName}`);
            const downloadUrl = `/pdf/raw/${record.modifiedName}`;
            client.emit('pdf_file', { url: downloadUrl });
        }
        catch (error) {
            console.error(`[WebSocket] Error registering client ${client.id} (pdfId: ${data.pdfId}):`, error.message);
        }
    }
};
exports.AppGateway = AppGateway;
__decorate([
    (0, websockets_1.SubscribeMessage)('register'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleRegister", null);
exports.AppGateway = AppGateway = __decorate([
    (0, websockets_1.WebSocketGateway)(WS_PORT, { cors: { origin: WS_CORS_ORIGIN } }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppGateway);
//# sourceMappingURL=app.gateway.js.map