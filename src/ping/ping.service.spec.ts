import { Test, TestingModule } from '@nestjs/testing';
import { PingService } from './ping.service';
import { PrismaService } from '../prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';

const mockPrisma = {
  pdfRecord: {
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('PingService', () => {
  let service: PingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PingService>(PingService);
    jest.clearAllMocks();
  });

  // ─── handlePing ───────────────────────────────────────────────────────────────

  describe('handlePing', () => {
    it('должен обновить lastPingAt по полю pdfId', async () => {
      mockPrisma.pdfRecord.update.mockResolvedValue({ id: 'uuid-1' });

      const result = await service.handlePing({ pdfId: 'uuid-1' });
      expect(result).toEqual({ success: true });
      expect(mockPrisma.pdfRecord.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { lastPingAt: expect.any(Date) },
      });
    });

    it('должен обновить lastPingAt по полю pdf_id', async () => {
      mockPrisma.pdfRecord.update.mockResolvedValue({ id: 'uuid-2' });

      const result = await service.handlePing({ pdf_id: 'uuid-2' });
      expect(result).toEqual({ success: true });
    });

    it('должен убрать префикс "pdf_id=" из строки', async () => {
      mockPrisma.pdfRecord.update.mockResolvedValue({ id: 'uuid-3' });

      await service.handlePing({ pdfId: 'pdf_id=uuid-3' });
      expect(mockPrisma.pdfRecord.update).toHaveBeenCalledWith({
        where: { id: 'uuid-3' },
        data: { lastPingAt: expect.any(Date) },
      });
    });

    it('должен выбросить 400 если pdfId не передан', async () => {
      await expect(service.handlePing({})).rejects.toThrow(
        new HttpException('pdfId is required', HttpStatus.BAD_REQUEST),
      );
    });

    it('должен выбросить 404 если pdfId не найден в БД', async () => {
      mockPrisma.pdfRecord.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.handlePing({ pdfId: 'bad-id' })).rejects.toThrow(
        new HttpException('Invalid pdfId', HttpStatus.NOT_FOUND),
      );
    });
  });

  // ─── getStatus ────────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('должен вернуть список записей с флагом isOnline=true', async () => {
      const recent = new Date(Date.now() - 60 * 1000); // 1 минута назад
      mockPrisma.pdfRecord.findMany.mockResolvedValue([
        { id: 'uuid-1', originalName: 'doc.pdf', lastPingAt: recent, createdAt: new Date() },
      ]);

      const result = await service.getStatus();
      expect(result[0].isOnline).toBe(true);
      expect(result[0].lastPingAt).toEqual(recent);
    });

    it('должен вернуть isOnline=false если пинг был давно', async () => {
      const old = new Date(Date.now() - 10 * 60 * 1000); // 10 минут назад
      mockPrisma.pdfRecord.findMany.mockResolvedValue([
        { id: 'uuid-2', originalName: 'doc.pdf', lastPingAt: old, createdAt: new Date() },
      ]);

      const result = await service.getStatus();
      expect(result[0].isOnline).toBe(false);
    });

    it('должен вернуть lastPingAt=null если пинга ещё не было (epoch=0)', async () => {
      mockPrisma.pdfRecord.findMany.mockResolvedValue([
        { id: 'uuid-3', originalName: 'doc.pdf', lastPingAt: new Date(0), createdAt: new Date() },
      ]);

      const result = await service.getStatus();
      expect(result[0].lastPingAt).toBeNull();
    });

    it('должен вернуть пустой массив если записей нет', async () => {
      mockPrisma.pdfRecord.findMany.mockResolvedValue([]);
      const result = await service.getStatus();
      expect(result).toEqual([]);
    });
  });
});
