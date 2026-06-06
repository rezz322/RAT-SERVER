import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ApkService } from '../apk/apk.service';
import { AppGateway } from '../app.gateway';

/** Устройство считается онлайн если последний пинг был не позже заданного таймаута */
const ONLINE_THRESHOLD_MS = process.env.ONLINE_THRESHOLD_MS
  ? parseInt(process.env.ONLINE_THRESHOLD_MS)
  : 5 * 60 * 1000;

@Injectable()
export class PingService {
  private readonly logger = new Logger(PingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apkService: ApkService,
  ) {}

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
      const record = await this.prisma.pdfRecord.update({
        where: { id: cleanPdfId },
        data: { lastPingAt: new Date() },
      });

      // Удаляем APK с диска — клиент уже подключился/пропинговал
      this.apkService.deleteApk(cleanPdfId, record.originalName);

      return { success: true };
    } catch (e) {
      this.logger.error(
        `Error updating pdfRecord for ping (pdfId=${cleanPdfId}): ${e.message}`,
      );
      throw new HttpException('Invalid pdfId', HttpStatus.NOT_FOUND);
    }
  }

  async getStatus() {
    const records = await this.prisma.pdfRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return records.map((r) => {
      const isOnline =
        AppGateway.activeClients.has(r.id) ||
        now.getTime() - r.lastPingAt.getTime() < ONLINE_THRESHOLD_MS;
      const displayLastPingAt =
        r.lastPingAt.getTime() === 0 ? null : r.lastPingAt;
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
