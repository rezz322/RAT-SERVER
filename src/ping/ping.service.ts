import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** Устройство считается онлайн если последний пинг был не позже 5 минут назад */
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

@Injectable()
export class PingService {
  constructor(private readonly prisma: PrismaService) {}

  async handlePing(body: any): Promise<{ success: boolean }> {
    let pdfId = body?.pdfId || body?.pdf_id;

    // Если body пустое — пробуем достать из ключей объекта (url-encoded формат)
    if (!pdfId && typeof body === 'object') {
      const keys = Object.keys(body);
      if (keys.length === 1 && keys[0].startsWith('pdf_id=')) {
        pdfId = keys[0];
      }
    }

    if (!pdfId) {
      throw new HttpException('pdfId is required', HttpStatus.BAD_REQUEST);
    }

    // Убираем возможный префикс "pdf_id="
    const cleanPdfId = pdfId.replace('pdf_id=', '');

    try {
      await this.prisma.pdfRecord.update({
        where: { id: cleanPdfId },
        data: { lastPingAt: new Date() },
      });
      return { success: true };
    } catch (e) {
      console.error('Error updating pdfRecord for ping:', e);
      throw new HttpException('Invalid pdfId', HttpStatus.NOT_FOUND);
    }
  }

  async getStatus() {
    const records = await this.prisma.pdfRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return records.map((r) => {
      const isOnline = now.getTime() - r.lastPingAt.getTime() < ONLINE_THRESHOLD_MS;
      const displayLastPingAt = r.lastPingAt.getTime() === 0 ? null : r.lastPingAt;
      return {
        id: r.id,
        originalName: r.originalName,
        isOnline,
        lastPingAt: displayLastPingAt,
        createdAt: r.createdAt,
      };
    });
  }
}
