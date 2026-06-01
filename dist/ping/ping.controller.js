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
exports.PingController = void 0;
const common_1 = require("@nestjs/common");
const ping_service_1 = require("./ping.service");
let PingController = class PingController {
    pingService;
    constructor(pingService) {
        this.pingService = pingService;
    }
    async ping(body, req) {
        console.log('Received ping from Android app:', { body, headers: req.headers });
        return this.pingService.handlePing(body);
    }
    async status() {
        return this.pingService.getStatus();
    }
};
exports.PingController = PingController;
__decorate([
    (0, common_1.Post)('ping'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PingController.prototype, "ping", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PingController.prototype, "status", null);
exports.PingController = PingController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [ping_service_1.PingService])
], PingController);
//# sourceMappingURL=ping.controller.js.map