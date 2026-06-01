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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let PingService = class PingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handlePing(body) {
        let pdfId = body?.pdfId || body?.pdf_id;
        if (!pdfId && typeof body === 'object') {
            const keys = Object.keys(body);
            if (keys.length === 1 && keys[0].startsWith('pdf_id=')) {
                pdfId = keys[0];
            }
        }
        if (!pdfId) {
            throw new common_1.HttpException('pdfId is required', common_1.HttpStatus.BAD_REQUEST);
        }
        const cleanPdfId = pdfId.replace('pdf_id=', '');
        try {
            await this.prisma.pdfRecord.update({
                where: { id: cleanPdfId },
                data: { lastPingAt: new Date() },
            });
            return { success: true };
        }
        catch (e) {
            console.error('Error updating pdfRecord for ping:', e);
            throw new common_1.HttpException('Invalid pdfId', common_1.HttpStatus.NOT_FOUND);
        }
    }
    async getStatus() {
        const records = await this.prisma.pdfRecord.findMany({
            orderBy: { createdAt: 'desc' },
        });
        const now = new Date();
        return records.map((r) => {
            const isOnline = now.getTime() - r.lastPingAt.getTime() < 5 * 60 * 1000;
            const displayLastPingAt = r.lastPingAt.getTime() === 0 ? null : r.lastPingAt;
            return {
                id: r.id,
                originalName: r.originalName,
                isOnline,
                lastPingAt: displayLastPingAt,
                createdAt: r.createdAt,
            };
        });
    }
};
exports.PingService = PingService;
exports.PingService = PingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PingService);
//# sourceMappingURL=ping.service.js.map