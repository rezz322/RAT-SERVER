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
var AppGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("./prisma.service");
const apk_service_1 = require("./apk/apk.service");
const build_events_1 = require("./build-events");
const WS_CORS_ORIGIN = process.env.BASE_URL || '*';
let AppGateway = class AppGateway {
    static { AppGateway_1 = this; }
    prisma;
    apkService;
    static activeClients = new Set();
    logger = new common_1.Logger(AppGateway_1.name);
    server;
    constructor(prisma, apkService) {
        this.prisma = prisma;
        this.apkService = apkService;
    }
    afterInit() {
        build_events_1.buildEvents.on('apk_building', ({ pdfId }) => {
            this.server.emit('apk_building', {
                pdfId,
                message: `APK для ${pdfId} собирается...`,
            });
        });
        build_events_1.buildEvents.on('apk_ready', ({ pdfId }) => {
            this.server.emit('apk_ready', {
                pdfId,
                message: `APK для ${pdfId} готов!`,
            });
        });
        build_events_1.buildEvents.on('apk_error', ({ pdfId, error }) => {
            this.server.emit('apk_error', {
                pdfId,
                error,
                message: `Ошибка сборки APK для ${pdfId}`,
            });
        });
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
        client.onAny((eventName, ...args) => {
            if (eventName !== 'register') {
                this.logger.debug(`Data from ${client.id} (event: '${eventName}'):`, args);
            }
        });
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const pdfId = client.data?.pdfId;
        if (pdfId) {
            AppGateway_1.activeClients.delete(pdfId);
            this.logger.log(`Client ${client.id} (pdfId: ${pdfId}) removed from active connections.`);
        }
    }
    async handleRegister(data, client) {
        if (!data || !data.pdfId) {
            console.log(`[WebSocket] Client ${client.id} sent invalid register payload`);
            return;
        }
        try {
            client.data = { pdfId: data.pdfId };
            AppGateway_1.activeClients.add(data.pdfId);
            const record = await this.prisma.pdfRecord.update({
                where: { id: data.pdfId },
                data: { lastPingAt: new Date() },
            });
            this.logger.log(`Client ${client.id} registered for PDF: ${record.originalName}`);
            this.apkService.deleteApk(data.pdfId, record.originalName);
            client.emit('pdf_file', { url: `/pdf/raw/${record.modifiedName}` });
        }
        catch (error) {
            this.logger.error(`Error registering client ${client.id} (pdfId: ${data.pdfId}): ${error.message}`);
        }
    }
};
exports.AppGateway = AppGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AppGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('register'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleRegister", null);
exports.AppGateway = AppGateway = AppGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: WS_CORS_ORIGIN } }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        apk_service_1.ApkService])
], AppGateway);
//# sourceMappingURL=app.gateway.js.map