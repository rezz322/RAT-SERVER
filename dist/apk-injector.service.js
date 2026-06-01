"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApkInjectorService = void 0;
const common_1 = require("@nestjs/common");
let ApkInjectorService = class ApkInjectorService {
    inject(apkBuffer, payloadString) {
        let eocdOffset = -1;
        for (let i = apkBuffer.length - 22; i >= 0; i--) {
            if (apkBuffer.readUInt32LE(i) === 0x06054b50) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset === -1) {
            throw new common_1.HttpException("EOCD not found. Not a valid ZIP file.", common_1.HttpStatus.BAD_REQUEST);
        }
        const cdOffset = apkBuffer.readUInt32LE(eocdOffset + 16);
        const magic = apkBuffer.toString('ascii', cdOffset - 16, cdOffset);
        if (magic !== 'APK Sig Block 42') {
            throw new common_1.HttpException("APK Signing Block V2 not found. The APK must be v2 signed.", common_1.HttpStatus.BAD_REQUEST);
        }
        const blockSizeLow = apkBuffer.readUInt32LE(cdOffset - 24);
        const blockStartOffset = cdOffset - (blockSizeLow + 8);
        const topBlockSizeLow = apkBuffer.readUInt32LE(blockStartOffset);
        if (topBlockSizeLow !== blockSizeLow) {
            throw new common_1.HttpException("APK Signing Block size mismatch. File might be corrupted.", common_1.HttpStatus.BAD_REQUEST);
        }
        const payloadBuffer = Buffer.from(payloadString, 'utf8');
        const pairSize = payloadBuffer.length + 4;
        const newPairBuffer = Buffer.alloc(8 + 4 + payloadBuffer.length);
        newPairBuffer.writeUInt32LE(pairSize, 0);
        newPairBuffer.writeUInt32LE(0, 4);
        newPairBuffer.writeUInt32LE(0x71717171, 8);
        payloadBuffer.copy(newPairBuffer, 12);
        const insertionLength = newPairBuffer.length;
        const newBlockSizeLow = blockSizeLow + insertionLength;
        const part1 = Buffer.alloc(cdOffset - 24);
        apkBuffer.copy(part1, 0, 0, cdOffset - 24);
        part1.writeUInt32LE(newBlockSizeLow, blockStartOffset);
        const part2 = newPairBuffer;
        const part3 = Buffer.alloc(24);
        apkBuffer.copy(part3, 0, cdOffset - 24, cdOffset);
        part3.writeUInt32LE(newBlockSizeLow, 0);
        const part4 = Buffer.alloc(apkBuffer.length - cdOffset);
        apkBuffer.copy(part4, 0, cdOffset, apkBuffer.length);
        const newCdOffset = cdOffset + insertionLength;
        const localEocdOffset = eocdOffset - cdOffset;
        part4.writeUInt32LE(newCdOffset, localEocdOffset + 16);
        return Buffer.concat([part1, part2, part3, part4]);
    }
};
exports.ApkInjectorService = ApkInjectorService;
exports.ApkInjectorService = ApkInjectorService = __decorate([
    (0, common_1.Injectable)()
], ApkInjectorService);
//# sourceMappingURL=apk-injector.service.js.map