import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';

// Мок шаблона HTML
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('<title>{{DOC_NAME}}</title><script>var APK="{{APK_URL}}"</script>'),
}));

const mockPrisma = {
  pdfRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
    jest.clearAllMocks();
  });

  // ─── uploadPdf ───────────────────────────────────────────────────────────────

  describe('uploadPdf', () => {
    const mockFile = {
      originalname: 'test.pdf',
      filename: 'file-123456.pdf',
    } as Express.Multer.File;

    it('должен вернуть pdfId и viewUrl при успехе', async () => {
      mockPrisma.pdfRecord.create.mockResolvedValue({
        id: 'uuid-1',
        originalName: 'test.pdf',
        modifiedName: 'file-123456.pdf',
        lastPingAt: new Date(0),
        createdAt: new Date(),
      });

      const result = await service.uploadPdf(mockFile);

      expect(result.pdfId).toBe('uuid-1');
      expect(result.viewUrl).toBe('/view/uuid-1');
      expect(result.message).toBe('File uploaded successfully');
    });

    it('должен выбросить 500 если Prisma упала', async () => {
      mockPrisma.pdfRecord.create.mockRejectedValue(new Error('DB error'));

      await expect(service.uploadPdf(mockFile)).rejects.toThrow(HttpException);
    });
  });

  // ─── renderViewPage ───────────────────────────────────────────────────────────

  describe('renderViewPage', () => {
    it('должен вернуть HTML с подставленными данными', async () => {
      mockPrisma.pdfRecord.findUnique.mockResolvedValue({
        id: 'uuid-1',
        originalName: 'Договор.pdf',
      });

      const html = await service.renderViewPage('uuid-1');

      expect(html).toContain('Договор.pdf');
      expect(html).toContain('/apk/download?pdfId=uuid-1');
    });

    it('должен экранировать HTML-символы в имени файла', async () => {
      mockPrisma.pdfRecord.findUnique.mockResolvedValue({
        id: 'uuid-2',
        originalName: '<script>alert(1)</script>.pdf',
      });

      const html = await service.renderViewPage('uuid-2');
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('должен выбросить 404 если запись не найдена', async () => {
      mockPrisma.pdfRecord.findUnique.mockResolvedValue(null);

      await expect(service.renderViewPage('non-existent')).rejects.toThrow(
        new HttpException('Not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  // ─── resolveViewId ────────────────────────────────────────────────────────────

  describe('resolveViewId', () => {
    it('должен найти id по modifiedName', async () => {
      mockPrisma.pdfRecord.findFirst.mockResolvedValue({ id: 'uuid-1' });

      const id = await service.resolveViewId('file-123.pdf');
      expect(id).toBe('uuid-1');
    });

    it('должен найти id по uuid без расширения', async () => {
      mockPrisma.pdfRecord.findFirst.mockResolvedValue(null);
      mockPrisma.pdfRecord.findUnique.mockResolvedValue({ id: 'uuid-1' });

      const id = await service.resolveViewId('uuid-1.pdf');
      expect(id).toBe('uuid-1');
    });

    it('должен выбросить 404 если файл не найден', async () => {
      mockPrisma.pdfRecord.findFirst.mockResolvedValue(null);
      mockPrisma.pdfRecord.findUnique.mockResolvedValue(null);

      await expect(service.resolveViewId('unknown.pdf')).rejects.toThrow(
        new HttpException('File not found', HttpStatus.NOT_FOUND),
      );
    });
  });
});
