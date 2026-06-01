import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from './prisma.service';

const WS_PORT = parseInt(process.env.WS_PORT || process.env.PORT || '8080');
const WS_CORS_ORIGIN = process.env.BASE_URL || '*';

@WebSocketGateway(WS_PORT, { cors: { origin: WS_CORS_ORIGIN } })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`[WebSocket] Client connected: ${client.id}`);

    // Перехватываем все входящие события для логирования
    client.onAny((eventName, ...args) => {
      // Игнорируем событие register, так как оно обрабатывается отдельно
      if (eventName !== 'register') {
        console.log(`[WebSocket] Data from client ${client.id} (event: '${eventName}'):`, args);
      }
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`[WebSocket] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('register')
  async handleRegister(
    @MessageBody() data: { pdfId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data || !data.pdfId) {
      console.log(`[WebSocket] Client ${client.id} sent invalid register payload`);
      return;
    }

    try {
      const record = await this.prisma.pdfRecord.update({
        where: { id: data.pdfId },
        data: { lastPingAt: new Date() },
      });

      console.log(`[WebSocket] Client ${client.id} registered for PDF: ${record.originalName}`);

      // Отправляем ссылку на скачивание сырого PDF-файла
      // Клиент получит это событие и сможет скачать файл по HTTP
      const downloadUrl = `/pdf/raw/${record.modifiedName}`;
      client.emit('pdf_file', { url: downloadUrl });

    } catch (error) {
      console.error(`[WebSocket] Error registering client ${client.id} (pdfId: ${data.pdfId}):`, error.message);
    }
  }
}
