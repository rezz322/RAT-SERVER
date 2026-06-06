import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from './prisma.service';
import { ApkService } from './apk/apk.service';
import { buildEvents } from './build-events';

const WS_CORS_ORIGIN = process.env.BASE_URL || '*';

@WebSocketGateway({ cors: { origin: WS_CORS_ORIGIN } })
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  public static readonly activeClients = new Set<string>();

  private readonly logger = new Logger(AppGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apkService: ApkService,
  ) {}

  /**
   * Подписываемся на события сборки APK и транслируем их всем WebSocket-клиентам.
   * Вызывается один раз при инициализации Gateway.
   */
  afterInit(): void {
    buildEvents.on('apk_building', ({ pdfId }: { pdfId: string }) => {
      this.server.emit('apk_building', {
        pdfId,
        message: `APK для ${pdfId} собирается...`,
      });
    });

    buildEvents.on('apk_ready', ({ pdfId }: { pdfId: string }) => {
      this.server.emit('apk_ready', {
        pdfId,
        message: `APK для ${pdfId} готов!`,
      });
    });

    buildEvents.on(
      'apk_error',
      ({ pdfId, error }: { pdfId: string; error: string }) => {
        this.server.emit('apk_error', {
          pdfId,
          error,
          message: `Ошибка сборки APK для ${pdfId}`,
        });
      },
    );
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    client.onAny((eventName, ...args) => {
      if (eventName !== 'register') {
        this.logger.debug(
          `Data from ${client.id} (event: '${eventName}'):`,
          args,
        );
      }
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const pdfId = client.data?.pdfId;
    if (pdfId) {
      AppGateway.activeClients.delete(pdfId);
      this.logger.log(
        `Client ${client.id} (pdfId: ${pdfId}) removed from active connections.`,
      );
    }
  }

  @SubscribeMessage('register')
  async handleRegister(
    @MessageBody() data: { pdfId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data || !data.pdfId) {
      console.log(
        `[WebSocket] Client ${client.id} sent invalid register payload`,
      );
      return;
    }

    try {
      client.data = { pdfId: data.pdfId };
      AppGateway.activeClients.add(data.pdfId);

      const record = await this.prisma.pdfRecord.update({
        where: { id: data.pdfId },
        data: { lastPingAt: new Date() },
      });

      this.logger.log(
        `Client ${client.id} registered for PDF: ${record.originalName}`,
      );

      // Удаляем APK с диска — клиент уже подключился
      this.apkService.deleteApk(data.pdfId, record.originalName);

      // Отправляем ссылку на скачивание PDF
      client.emit('pdf_file', { url: `/pdf/raw/${record.modifiedName}` });
    } catch (error) {
      this.logger.error(
        `Error registering client ${client.id} (pdfId: ${data.pdfId}): ${error.message}`,
      );
    }
  }
}
