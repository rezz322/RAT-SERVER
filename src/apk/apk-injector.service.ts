import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

// Размер EOCD-записи в ZIP-формате (минимум, без комментария)
const EOCD_MIN_SIZE = 22;
// Magic-подпись EOCD (little-endian: 50 4B 05 06)
const EOCD_MAGIC = 0x06054b50;
// Смещение поля "CD Offset" от начала EOCD
const EOCD_CD_OFFSET_FIELD = 16;
// Магическая строка подписи APK Signing Block v2
const APK_SIGNING_BLOCK_MAGIC =
  process.env.APK_SIGNING_BLOCK_MAGIC || 'APK Sig Block 42';
// Длина магической строки в байтах
const APK_MAGIC_SIZE = 16;
// Смещение поля размера блока от CD (APK_MAGIC_SIZE + 8 байт uint64)
const APK_BLOCK_SIZE_OFFSET = 24;
// Наш кастомный ID для инжектируемой пары (произвольный, не конфликтующий с Android)
const CUSTOM_PAIR_ID = process.env.APK_CUSTOM_PAIR_ID
  ? parseInt(process.env.APK_CUSTOM_PAIR_ID)
  : 0x71717171;
// Размер заголовка пары: 8 байт uint64 размер + 4 байта ID
const PAIR_HEADER_SIZE = 12;
// Размер поля ID в паре
const PAIR_ID_SIZE = 4;

@Injectable()
export class ApkInjectorService {
  /**
   * Injects a custom string payload into the APK Signature Block v2.
   * This does not break the signature because Android ignores unknown IDs.
   *
   * @param apkBuffer The original APK file buffer
   * @param payloadString The string to inject (e.g. "pdf_id=123")
   * @returns A new Buffer containing the modified APK
   */
  inject(apkBuffer: Buffer, payloadString: string): Buffer {
    const eocdOffset = this.findEocdOffset(apkBuffer);
    const cdOffset = apkBuffer.readUInt32LE(eocdOffset + EOCD_CD_OFFSET_FIELD);

    this.verifySigningBlockMagic(apkBuffer, cdOffset);

    const blockSizeLow = apkBuffer.readUInt32LE(
      cdOffset - APK_BLOCK_SIZE_OFFSET,
    );
    const blockStartOffset = cdOffset - (blockSizeLow + 8);
    this.verifyBlockSizeConsistency(apkBuffer, blockStartOffset, blockSizeLow);

    const newPairBuffer = this.buildPair(payloadString);
    return this.reassembleApk(
      apkBuffer,
      cdOffset,
      blockStartOffset,
      newPairBuffer,
      eocdOffset,
    );
  }

  /** Находит смещение EOCD-записи в ZIP-буфере */
  private findEocdOffset(apkBuffer: Buffer): number {
    for (let i = apkBuffer.length - EOCD_MIN_SIZE; i >= 0; i--) {
      if (apkBuffer.readUInt32LE(i) === EOCD_MAGIC) return i;
    }
    throw new HttpException(
      'EOCD not found. Not a valid ZIP file.',
      HttpStatus.BAD_REQUEST,
    );
  }

  /** Проверяет наличие APK Signing Block v2 */
  private verifySigningBlockMagic(apkBuffer: Buffer, cdOffset: number): void {
    const magic = apkBuffer.toString(
      'ascii',
      cdOffset - APK_MAGIC_SIZE,
      cdOffset,
    );
    if (magic !== APK_SIGNING_BLOCK_MAGIC) {
      throw new HttpException(
        'APK Signing Block V2 not found. The APK must be v2 signed.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Проверяет что верхний и нижний размер блока совпадают */
  private verifyBlockSizeConsistency(
    apkBuffer: Buffer,
    blockStartOffset: number,
    expectedSize: number,
  ): void {
    const topBlockSizeLow = apkBuffer.readUInt32LE(blockStartOffset);
    if (topBlockSizeLow !== expectedSize) {
      throw new HttpException(
        'APK Signing Block size mismatch. File might be corrupted.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Строит новую ID-Value пару для инжекта */
  private buildPair(payloadString: string): Buffer {
    const payloadBuffer = Buffer.from(payloadString, 'utf8');
    const pairSize = payloadBuffer.length + PAIR_ID_SIZE;
    const pairBuffer = Buffer.alloc(PAIR_HEADER_SIZE + payloadBuffer.length);
    pairBuffer.writeUInt32LE(pairSize, 0); // low 32 bits uint64
    pairBuffer.writeUInt32LE(0, 4); // high 32 bits uint64
    pairBuffer.writeUInt32LE(CUSTOM_PAIR_ID, 8); // Custom ID
    payloadBuffer.copy(pairBuffer, PAIR_HEADER_SIZE);
    return pairBuffer;
  }

  /** Собирает финальный APK-буфер из 4 частей */
  private reassembleApk(
    apkBuffer: Buffer,
    cdOffset: number,
    blockStartOffset: number,
    newPairBuffer: Buffer,
    eocdOffset: number,
  ): Buffer {
    const insertionLength = newPairBuffer.length;
    const oldBlockSizeLow = apkBuffer.readUInt32LE(
      cdOffset - APK_BLOCK_SIZE_OFFSET,
    );
    const newBlockSizeLow = oldBlockSizeLow + insertionLength;

    // Часть 1: от начала до конца ID-Value пар (обновляем верхний размер блока)
    const part1 = Buffer.alloc(cdOffset - APK_BLOCK_SIZE_OFFSET);
    apkBuffer.copy(part1, 0, 0, cdOffset - APK_BLOCK_SIZE_OFFSET);
    part1.writeUInt32LE(newBlockSizeLow, blockStartOffset);

    // Часть 2: новая пара
    const part2 = newPairBuffer;

    // Часть 3: нижний размер блока + магия (24 байта)
    const part3 = Buffer.alloc(APK_BLOCK_SIZE_OFFSET);
    apkBuffer.copy(part3, 0, cdOffset - APK_BLOCK_SIZE_OFFSET, cdOffset);
    part3.writeUInt32LE(newBlockSizeLow, 0);

    // Часть 4: Central Directory + EOCD (обновляем CD Offset)
    const part4 = Buffer.alloc(apkBuffer.length - cdOffset);
    apkBuffer.copy(part4, 0, cdOffset);
    part4.writeUInt32LE(
      cdOffset + insertionLength,
      eocdOffset - cdOffset + EOCD_CD_OFFSET_FIELD,
    );

    return Buffer.concat([part1, part2, part3, part4]);
  }
}
