"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApkModule = void 0;
const common_1 = require("@nestjs/common");
const apk_controller_1 = require("./apk.controller");
const apk_service_1 = require("./apk.service");
const apk_injector_service_1 = require("../apk-injector.service");
let ApkModule = class ApkModule {
};
exports.ApkModule = ApkModule;
exports.ApkModule = ApkModule = __decorate([
    (0, common_1.Module)({
        controllers: [apk_controller_1.ApkController],
        providers: [apk_service_1.ApkService, apk_injector_service_1.ApkInjectorService],
    })
], ApkModule);
//# sourceMappingURL=apk.module.js.map