import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ApkInjectorService } from './apk-injector.service';

// ─── Минимальный валидный APK Signing Block v2 для тестов ──────────────────────
//
// Структура:
//  [ZIP content: пустой, 0 байт]
//  [APK Signing Block]
//    8 байт: block_size (little-endian uint64)
//    [ID-Value pairs ... ]
//    8 байт: block_size (дубль, little-endian uint64)
//    16 байт: "APK Sig Block 42"
//  [Central Directory: 0 байт]
//  [EOCD: 22 байта]

function buildMinimalApkBuffer(): Buffer {
  // APK Signing Block без пар — только размер + магия
  // block_size = 16 (размер Magic) + 8 (нижний size) = 24 байта
  const blockSize = 24;

  const signingBlock = Buffer.alloc(8 + blockSize);
  // Верхний size (8 байт LE)
  signingBlock.writeUInt32LE(blockSize, 0);
  signingBlock.writeUInt32LE(0, 4);
  // Нижний size (8 байт LE) — начало с offset 8
  signingBlock.writeUInt32LE(blockSize, 8);
  signingBlock.writeUInt32LE(0, 12);
  // Magic (16 байт)
  signingBlock.write('APK Sig Block 42', 16, 'ascii');

  // Central Directory — пустой (0 байт)
  const cdOffset = signingBlock.length; // = 32

  // EOCD (22 байта)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD magic
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with CD
  eocd.writeUInt16LE(0, 8); // entries on disk
  eocd.writeUInt16LE(0, 10); // total entries
  eocd.writeUInt32LE(0, 12); // CD size
  eocd.writeUInt32LE(cdOffset, 16); // CD offset ← указывает на конец Signing Block
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([signingBlock, eocd]);
}

/**
 * Парсит инжектированный APK и возвращает payload нашей пары (ID=0x71717171).
 */
function extractInjectedPayload(apkBuffer: Buffer): string | null {
  // Находим EOCD
  let eocdIdx = -1;
  for (let i = apkBuffer.length - 22; i >= 0; i--) {
    if (apkBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdIdx = i;
      break;
    }
  }
  if (eocdIdx === -1) return null;

  const cdOffset = apkBuffer.readUInt32LE(eocdIdx + 16);
  const blockSizeLow = apkBuffer.readUInt32LE(cdOffset - 24);
  const blockStart = cdOffset - blockSizeLow - 8;

  // Перебираем пары начиная с blockStart + 8 (пропускаем верхний size)
  let pos = blockStart + 8;
  while (pos < cdOffset - 24) {
    const pairSizeLow = apkBuffer.readUInt32LE(pos);
    pos += 8; // пропускаем uint64 size
    const pairId = apkBuffer.readUInt32LE(pos);
    pos += 4;

    if (pairId === 0x71717171) {
      const valueLen = pairSizeLow - 4;
      return apkBuffer.toString('utf8', pos, pos + valueLen);
    }
    pos += pairSizeLow - 4;
  }
  return null;
}

// ─── Тесты ────────────────────────────────────────────────────────────────────

describe('ApkInjectorService', () => {
  let service: ApkInjectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApkInjectorService],
    }).compile();

    service = module.get<ApkInjectorService>(ApkInjectorService);
  });

  // ─── inject: успешные сценарии ────────────────────────────────────────────

  describe('inject — успешные сценарии', () => {
    it('должен вернуть Buffer больше исходного', () => {
      const apk = buildMinimalApkBuffer();
      const result = service.inject(apk, 'pdf_id=test-uuid');

      expect(result.length).toBeGreaterThan(apk.length);
    });

    it('инжектированный payload должен читаться из Signing Block', () => {
      const apk = buildMinimalApkBuffer();
      const result = service.inject(apk, 'pdf_id=abc-123');

      const payload = extractInjectedPayload(result);
      expect(payload).toBe('pdf_id=abc-123');
    });

    it('должен корректно работать с длинным pdfId (UUID)', () => {
      const apk = buildMinimalApkBuffer();
      const pdfId = 'pdf_id=550e8400-e29b-41d4-a716-446655440000';
      const result = service.inject(apk, pdfId);

      expect(extractInjectedPayload(result)).toBe(pdfId);
    });

    it('должен обновить CD offset в EOCD после инжекта', () => {
      const apk = buildMinimalApkBuffer();
      const payload = 'pdf_id=test';
      const result = service.inject(apk, payload);

      // Находим EOCD в результате
      let eocdIdx = -1;
      for (let i = result.length - 22; i >= 0; i--) {
        if (result.readUInt32LE(i) === 0x06054b50) {
          eocdIdx = i;
          break;
        }
      }
      expect(eocdIdx).not.toBe(-1);

      // CD offset должен быть больше чем в исходном APK
      const oldCdOffset = apk.readUInt32LE(apk.length - 22 + 16);
      const newCdOffset = result.readUInt32LE(eocdIdx + 16);
      expect(newCdOffset).toBeGreaterThan(oldCdOffset);
    });

    it('размер добавления = размер пары (12 байт заголовок + payload)', () => {
      const apk = buildMinimalApkBuffer();
      const payload = 'pdf_id=x';
      const payloadBytes = Buffer.from(payload, 'utf8').length;
      const expectedDelta = 12 + payloadBytes; // PAIR_HEADER_SIZE + payload

      const result = service.inject(apk, payload);
      expect(result.length - apk.length).toBe(expectedDelta);
    });
  });

  // ─── inject: невалидные APK ───────────────────────────────────────────────

  describe('inject — невалидные данные', () => {
    it('должен выбросить 400 если буфер не ZIP (нет EOCD)', () => {
      const invalidBuffer = Buffer.from('not a zip file');

      expect(() => service.inject(invalidBuffer, 'pdf_id=x')).toThrow(
        new HttpException(
          'EOCD not found. Not a valid ZIP file.',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('должен выбросить 400 если нет APK Signing Block v2', () => {
      // ZIP без Signing Block: сразу CD (пустой) и EOCD
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0); // EOCD magic
      eocd.writeUInt32LE(0, 16); // CD offset = 0 (нет контента перед EOCD)
      eocd.writeUInt16LE(0, 20);

      expect(() => service.inject(eocd, 'pdf_id=x')).toThrow(
        new HttpException(
          'APK Signing Block V2 not found. The APK must be v2 signed.',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('должен выбросить 400 при расхождении размеров блока', () => {
      const apk = buildMinimalApkBuffer();

      // Портим верхний размер блока (первые 4 байта)
      apk.writeUInt32LE(9999, 0);

      expect(() => service.inject(apk, 'pdf_id=x')).toThrow(
        new HttpException(
          'APK Signing Block size mismatch. File might be corrupted.',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  // ─── inject: идемпотентность ──────────────────────────────────────────────

  describe('inject — идемпотентность', () => {
    it('двойной инжект не ломает структуру APK — EOCD и CD offset корректны', () => {
      const apk = buildMinimalApkBuffer();

      const once = service.inject(apk, 'pdf_id=first');
      const twice = service.inject(once, 'pdf_id=second');

      // После двух инжектов APK должен быть длиннее исходного
      expect(twice.length).toBeGreaterThan(once.length);
      expect(twice.length).toBeGreaterThan(apk.length);

      // EOCD должен присутствовать (магия 0x06054B50)
      let hasEocd = false;
      for (let i = twice.length - 22; i >= 0; i--) {
        if (twice.readUInt32LE(i) === 0x06054b50) {
          hasEocd = true;
          break;
        }
      }
      expect(hasEocd).toBe(true);

      // Первая найденная пара — та что была инжектирована первой (вставляется в начало блока)
      const payload = extractInjectedPayload(twice);
      expect(payload).toBe('pdf_id=first');
    });
  });
});
