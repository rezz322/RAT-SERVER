import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma.service';
import { ApkService } from '../apk/apk.service';
import { HttpException, HttpStatus } from '@nestjs/common';

// Мок шаблона HTML
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest
    .fn()
    .mockReturnValue('<title>{{DOC_NAME}}</title><div>{{APK_URL}}</div>'),
}));

const mockPrisma = {
  pdfRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockApkService = {
  enqueueApkBuild: jest.fn(),
};

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ApkService, useValue: mockApkService },
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
      path: '/uploads/original/file-123456.pdf',
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

    it('должен поставить сборку APK в очередь с правильными аргументами', async () => {
      mockPrisma.pdfRecord.create.mockResolvedValue({
        id: 'uuid-1',
        originalName: 'test.pdf',
        modifiedName: 'file-123456.pdf',
        lastPingAt: new Date(0),
        createdAt: new Date(),
      });

      await service.uploadPdf(mockFile);

      expect(mockApkService.enqueueApkBuild).toHaveBeenCalledTimes(1);
      expect(mockApkService.enqueueApkBuild).toHaveBeenCalledWith(
        'uuid-1',
        mockFile.path,
        'test.pdf',
      );
    });

    it('не должен возвращать downloadUrl (убрано как дубликат viewUrl)', async () => {
      mockPrisma.pdfRecord.create.mockResolvedValue({
        id: 'uuid-1',
        originalName: 'test.pdf',
        modifiedName: 'file-123456.pdf',
        lastPingAt: new Date(0),
        createdAt: new Date(),
      });

      const result = await service.uploadPdf(mockFile);
      expect(result).not.toHaveProperty('downloadUrl');
    });

    it('должен выбросить 500 если Prisma упала', async () => {
      mockPrisma.pdfRecord.create.mockRejectedValue(new Error('DB error'));

      await expect(service.uploadPdf(mockFile)).rejects.toThrow(
        new HttpException(
          'Error uploading PDF: DB error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('не должен вызывать enqueueApkBuild если Prisma упала', async () => {
      mockPrisma.pdfRecord.create.mockRejectedValue(new Error('DB error'));

      await expect(service.uploadPdf(mockFile)).rejects.toThrow();
      expect(mockApkService.enqueueApkBuild).not.toHaveBeenCalled();
    });
  });

  // ─── renderViewPage ───────────────────────────────────────────────────────────

  describe('renderViewPage', () => {
    it('должен вернуть HTML с подставленным именем документа', async () => {
      mockPrisma.pdfRecord.findUnique.mockResolvedValue({
        id: 'uuid-1',
        originalName: 'Договор.pdf',
      });

      const html = await service.renderViewPage('uuid-1');
      expect(html).toContain('Договор.pdf');
    });

    it('должен содержать APK download URL', async () => {
      mockPrisma.pdfRecord.findUnique.mockResolvedValue({
        id: 'uuid-1',
        originalName: 'doc.pdf',
      });

      const html = await service.renderViewPage('uuid-1');
      expect(html).toContain('/apk/download');
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

    it('должен найти id по uuid без расширения если findFirst не нашёл', async () => {
      mockPrisma.pdfRecord.findFirst.mockResolvedValue(null);
      mockPrisma.pdfRecord.findUnique.mockResolvedValue({ id: 'uuid-1' });

      const id = await service.resolveViewId('uuid-1.pdf');
      expect(id).toBe('uuid-1');
    });

    it('должен выбросить 404 если файл не найден ни одним способом', async () => {
      mockPrisma.pdfRecord.findFirst.mockResolvedValue(null);
      mockPrisma.pdfRecord.findUnique.mockResolvedValue(null);

      await expect(service.resolveViewId('unknown.pdf')).rejects.toThrow(
        new HttpException('File not found', HttpStatus.NOT_FOUND),
      );
    });
  });
});
