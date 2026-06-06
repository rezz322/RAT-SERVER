"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingModule = void 0;
const common_1 = require("@nestjs/common");
const ping_controller_1 = require("./ping.controller");
const ping_service_1 = require("./ping.service");
const prisma_service_1 = require("../prisma.service");
const apk_module_1 = require("../apk/apk.module");
let PingModule = class PingModule {
};
exports.PingModule = PingModule;
exports.PingModule = PingModule = __decorate([
    (0, common_1.Module)({
        imports: [apk_module_1.ApkModule],
        controllers: [ping_controller_1.PingController],
        providers: [ping_service_1.PingService, prisma_service_1.PrismaService],
    })
], PingModule);
//# sourceMappingURL=ping.module.js.map