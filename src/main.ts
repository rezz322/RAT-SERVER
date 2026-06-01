import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dgram from 'dgram';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  const mainPort = process.env.PORT ? parseInt(process.env.PORT) : 8080;
  
  // Запускаем HTTP-сервер на основном порту (TCP 8080)
  await app.listen(mainPort, '0.0.0.0');
  console.log(`HTTP Server is running on port ${mainPort}`);

  // Запускаем UDP-сервер на том же порту (UDP 8080)
  const udpServer = dgram.createSocket('udp4');
  
  udpServer.on('error', (err) => {
    console.error(`[UDP] Server error:\n${err.stack}`);
    udpServer.close();
  });

  udpServer.on('message', (msg, rinfo) => {
    const message = msg.toString();
    
    // Если запрос начинается с "pdf_id=", это сырой UDP-запрос от C++
    if (message.startsWith('pdf_id=')) {
      const pdfId = message.replace('pdf_id=', '').trim();
      console.log(`[UDP] Received raw ping for pdfId: ${pdfId} from ${rinfo.address}:${rinfo.port}`);
      
      const prisma = app.get(PrismaService);
      prisma.pdfRecord.update({
        where: { id: pdfId },
        data: { lastPingAt: new Date() }
      }).then((record) => {
        // Формируем полную абсолютную HTTP ссылку (берётся из BASE_URL в .env)
        const baseUrl = process.env.BASE_URL || `http://localhost:${mainPort}`;
        const pdfLink = `${baseUrl}/pdf/raw/${record.modifiedName}`;
        
        // Отправляем ссылку обратно по UDP
        const responseMsg = Buffer.from(`${pdfLink}\n`);
        udpServer.send(responseMsg, rinfo.port, rinfo.address, (err) => {
          if (err) {
            console.error('[UDP] Error sending response:', err);
          } else {
            console.log(`[UDP] Sent link to ${rinfo.address}:${rinfo.port}`);
          }
        });
      }).catch(err => {
        console.error('[UDP] Error updating record:', err);
        const errorMsg = Buffer.from('ERROR\n');
        udpServer.send(errorMsg, rinfo.port, rinfo.address);
      });
    } else {
      // Любые другие данные, присланные по UDP, просто выводим в консоль
      console.log(`[UDP] Data from ${rinfo.address}:${rinfo.port}: ${message}`);
    }
  });

  udpServer.on('listening', () => {
    const address = udpServer.address();
    console.log(`UDP Server is listening on ${address.address}:${address.port}`);
  });

  udpServer.bind(mainPort);
}
bootstrap();
