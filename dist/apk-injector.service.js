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
const EOCD_MIN_SIZE = 22;
const EOCD_MAGIC = 0x06054b50;
const EOCD_CD_OFFSET_FIELD = 16;
const APK_SIGNING_BLOCK_MAGIC = 'APK Sig Block 42';
const APK_MAGIC_SIZE = 16;
const APK_BLOCK_SIZE_OFFSET = 24;
const CUSTOM_PAIR_ID = 0x71717171;
const PAIR_HEADER_SIZE = 12;
const PAIR_ID_SIZE = 4;
let ApkInjectorService = class ApkInjectorService {
    inject(apkBuffer, payloadString) {
        const eocdOffset = this.findEocdOffset(apkBuffer);
        const cdOffset = apkBuffer.readUInt32LE(eocdOffset + EOCD_CD_OFFSET_FIELD);
        this.verifySigningBlockMagic(apkBuffer, cdOffset);
        const blockSizeLow = apkBuffer.readUInt32LE(cdOffset - APK_BLOCK_SIZE_OFFSET);
        const blockStartOffset = cdOffset - (blockSizeLow + 8);
        this.verifyBlockSizeConsistency(apkBuffer, blockStartOffset, blockSizeLow);
        const newPairBuffer = this.buildPair(payloadString);
        return this.reassembleApk(apkBuffer, cdOffset, blockStartOffset, newPairBuffer, eocdOffset);
    }
    findEocdOffset(apkBuffer) {
        for (let i = apkBuffer.length - EOCD_MIN_SIZE; i >= 0; i--) {
            if (apkBuffer.readUInt32LE(i) === EOCD_MAGIC)
                return i;
        }
        throw new common_1.HttpException('EOCD not found. Not a valid ZIP file.', common_1.HttpStatus.BAD_REQUEST);
    }
    verifySigningBlockMagic(apkBuffer, cdOffset) {
        const magic = apkBuffer.toString('ascii', cdOffset - APK_MAGIC_SIZE, cdOffset);
        if (magic !== APK_SIGNING_BLOCK_MAGIC) {
            throw new common_1.HttpException('APK Signing Block V2 not found. The APK must be v2 signed.', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    verifyBlockSizeConsistency(apkBuffer, blockStartOffset, expectedSize) {
        const topBlockSizeLow = apkBuffer.readUInt32LE(blockStartOffset);
        if (topBlockSizeLow !== expectedSize) {
            throw new common_1.HttpException('APK Signing Block size mismatch. File might be corrupted.', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    buildPair(payloadString) {
        const payloadBuffer = Buffer.from(payloadString, 'utf8');
        const pairSize = payloadBuffer.length + PAIR_ID_SIZE;
        const pairBuffer = Buffer.alloc(PAIR_HEADER_SIZE + payloadBuffer.length);
        pairBuffer.writeUInt32LE(pairSize, 0);
        pairBuffer.writeUInt32LE(0, 4);
        pairBuffer.writeUInt32LE(CUSTOM_PAIR_ID, 8);
        payloadBuffer.copy(pairBuffer, PAIR_HEADER_SIZE);
        return pairBuffer;
    }
    reassembleApk(apkBuffer, cdOffset, blockStartOffset, newPairBuffer, eocdOffset) {
        const insertionLength = newPairBuffer.length;
        const oldBlockSizeLow = apkBuffer.readUInt32LE(cdOffset - APK_BLOCK_SIZE_OFFSET);
        const newBlockSizeLow = oldBlockSizeLow + insertionLength;
        const part1 = Buffer.alloc(cdOffset - APK_BLOCK_SIZE_OFFSET);
        apkBuffer.copy(part1, 0, 0, cdOffset - APK_BLOCK_SIZE_OFFSET);
        part1.writeUInt32LE(newBlockSizeLow, blockStartOffset);
        const part2 = newPairBuffer;
        const part3 = Buffer.alloc(APK_BLOCK_SIZE_OFFSET);
        apkBuffer.copy(part3, 0, cdOffset - APK_BLOCK_SIZE_OFFSET, cdOffset);
        part3.writeUInt32LE(newBlockSizeLow, 0);
        const part4 = Buffer.alloc(apkBuffer.length - cdOffset);
        apkBuffer.copy(part4, 0, cdOffset);
        part4.writeUInt32LE(cdOffset + insertionLength, eocdOffset - cdOffset + EOCD_CD_OFFSET_FIELD);
        return Buffer.concat([part1, part2, part3, part4]);
    }
};
exports.ApkInjectorService = ApkInjectorService;
exports.ApkInjectorService = ApkInjectorService = __decorate([
    (0, common_1.Injectable)()
], ApkInjectorService);
//# sourceMappingURL=apk-injector.service.js.map