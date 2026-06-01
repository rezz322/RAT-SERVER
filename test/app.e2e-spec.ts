import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

/**
 * E2E-тесты для всех HTTP-эндпоинтов.
 * PrismaService мокается — реальная БД не нужна.
 */

const MOCK_RECORD = {
  id: 'test-uuid-1234',
  originalName: 'договор.pdf',
  modifiedName: 'file-99999.pdf',
  lastPingAt: new Date(Date.now() - 60_000),
  createdAt: new Date(),
};

const mockPrisma = {
  pdfRecord: {
    create: jest.fn().mockResolvedValue(MOCK_RECORD),
    findUnique: jest.fn().mockResolvedValue(MOCK_RECORD),
    findFirst: jest.fn().mockResolvedValue(MOCK_RECORD),
    findMany: jest.fn().mockResolvedValue([MOCK_RECORD]),
    update: jest.fn().mockResolvedValue(MOCK_RECORD),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

describe('E2E — все эндпоинты', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Восстанавливаем дефолтные ответы моков после каждого теста
    mockPrisma.pdfRecord.create.mockResolvedValue(MOCK_RECORD);
    mockPrisma.pdfRecord.findUnique.mockResolvedValue(MOCK_RECORD);
    mockPrisma.pdfRecord.findFirst.mockResolvedValue(MOCK_RECORD);
    mockPrisma.pdfRecord.findMany.mockResolvedValue([MOCK_RECORD]);
    mockPrisma.pdfRecord.update.mockResolvedValue(MOCK_RECORD);
  });

  // ─── GET / ───────────────────────────────────────────────────────────────────

  describe('GET /', () => {
    it('должен вернуть 200 OK', () => {
      return request(app.getHttpServer()).get('/').expect(200).expect('OK');
    });
  });

  // ─── POST /pdf/upload ─────────────────────────────────────────────────────────

  describe('POST /pdf/upload', () => {
    it('должен вернуть 400 если файл не приложен', () => {
      return request(app.getHttpServer()).post('/pdf/upload').expect(400);
    });

    it('должен вернуть 400 если тип файла не PDF', () => {
      return request(app.getHttpServer())
        .post('/pdf/upload')
        .attach('file', Buffer.from('not a pdf'), { filename: 'test.txt', contentType: 'text/plain' })
        .expect(400);
    });

    it('должен вернуть pdfId и viewUrl при успешной загрузке', async () => {
      // Создаём минимальный реальный PDF-буфер (1 байт — просто для mime-типа)
      const fakePdf = Buffer.from('%PDF-1.4 fake');

      const res = await request(app.getHttpServer())
        .post('/pdf/upload')
        .attach('file', fakePdf, { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(201);

      expect(res.body).toMatchObject({
        message: 'File uploaded successfully',
        pdfId: expect.any(String),
        viewUrl: expect.stringContaining('/view/'),
      });
    });
  });

  // ─── GET /view/:id ────────────────────────────────────────────────────────────

  describe('GET /view/:id', () => {
    it('должен вернуть HTML-страницу с именем документа', async () => {
      const res = await request(app.getHttpServer())
        .get(`/view/${MOCK_RECORD.id}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('договор.pdf');
    });

    it('должен вернуть 404 если запись не найдена', () => {
      mockPrisma.pdfRecord.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer()).get('/view/non-existent-id').expect(404);
    });
  });

  // ─── GET /pdf/:filename (редирект) ────────────────────────────────────────────

  describe('GET /pdf/:filename', () => {
    it('должен редиректить на /view/:id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pdf/${MOCK_RECORD.modifiedName}`)
        .expect(302);

      expect(res.headers['location']).toBe(`/view/${MOCK_RECORD.id}`);
    });

    it('должен вернуть 404 если файл не найден', () => {
      mockPrisma.pdfRecord.findFirst.mockResolvedValue(null);
      mockPrisma.pdfRecord.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer()).get('/pdf/nonexistent.pdf').expect(404);
    });
  });

  // ─── GET /pdf/download/:id ────────────────────────────────────────────────────

  describe('GET /pdf/download/:id', () => {
    it('должен редиректить на /view/:id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/pdf/download/${MOCK_RECORD.id}`)
        .expect(302);

      expect(res.headers['location']).toBe(`/view/${MOCK_RECORD.id}`);
    });
  });

  // ─── GET /apk/download ────────────────────────────────────────────────────────

  describe('GET /apk/download', () => {
    it('должен вернуть APK-файл с правильным Content-Type', async () => {
      // Создаём временный APK-плейсхолдер если не существует
      const apkDir = path.join(process.cwd(), 'apk');
      const apkPath = path.join(apkDir, 'app.apk');
      if (!fs.existsSync(apkDir)) fs.mkdirSync(apkDir, { recursive: true });
      if (!fs.existsSync(apkPath)) fs.writeFileSync(apkPath, 'placeholder');

      const res = await request(app.getHttpServer())
        .get('/apk/download')
        .expect(200);

      expect(res.headers['content-type']).toContain('application/vnd.android.package-archive');
      expect(res.headers['content-disposition']).toContain('AdobePlugin.apk');
    });
  });

  // ─── POST /api/ping ───────────────────────────────────────────────────────────

  describe('POST /api/ping', () => {
    it('должен вернуть { success: true } при корректном pdfId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ping')
        .send({ pdfId: MOCK_RECORD.id })
        .expect(201);

      expect(res.body).toEqual({ success: true });
    });

    it('должен вернуть 400 если pdfId не передан', () => {
      return request(app.getHttpServer()).post('/api/ping').send({}).expect(400);
    });

    it('должен вернуть 404 если pdfId не найден', () => {
      mockPrisma.pdfRecord.update.mockRejectedValue(new Error('Not found'));

      return request(app.getHttpServer())
        .post('/api/ping')
        .send({ pdfId: 'bad-uuid' })
        .expect(404);
    });
  });

  // ─── GET /api/status ──────────────────────────────────────────────────────────

  describe('GET /api/status', () => {
    it('должен вернуть массив со статусом записей', async () => {
      const res = await request(app.getHttpServer()).get('/api/status').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: MOCK_RECORD.id,
        originalName: MOCK_RECORD.originalName,
        isOnline: expect.any(Boolean),
        createdAt: expect.any(String),
      });
    });

    it('должен вернуть isOnline=true для недавнего пинга', async () => {
      mockPrisma.pdfRecord.findMany.mockResolvedValue([
        { ...MOCK_RECORD, lastPingAt: new Date(Date.now() - 30_000) },
      ]);

      const res = await request(app.getHttpServer()).get('/api/status').expect(200);
      expect(res.body[0].isOnline).toBe(true);
    });

    it('должен вернуть isOnline=false для старого пинга', async () => {
      mockPrisma.pdfRecord.findMany.mockResolvedValue([
        { ...MOCK_RECORD, lastPingAt: new Date(Date.now() - 10 * 60_000) },
      ]);

      const res = await request(app.getHttpServer()).get('/api/status').expect(200);
      expect(res.body[0].isOnline).toBe(false);
    });

    it('должен вернуть lastPingAt=null если устройство ни разу не пинговало', async () => {
      mockPrisma.pdfRecord.findMany.mockResolvedValue([
        { ...MOCK_RECORD, lastPingAt: new Date(0) },
      ]);

      const res = await request(app.getHttpServer()).get('/api/status').expect(200);
      expect(res.body[0].lastPingAt).toBeNull();
    });

    it('должен вернуть пустой массив если записей нет', async () => {
      mockPrisma.pdfRecord.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer()).get('/api/status').expect(200);
      expect(res.body).toEqual([]);
    });
  });
});
