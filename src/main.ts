import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dgram from 'dgram';
import { PrismaService } from './prisma.service';

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const UDP_PORT = process.env.UDP_PORT
  ? parseInt(process.env.UDP_PORT)
  : DEFAULT_PORT;
const PDF_ID_PREFIX = process.env.PDF_ID_PREFIX || 'pdf_id=';
const UDP_ERROR_RESPONSE = process.env.UDP_ERROR_RESPONSE || 'ERROR\n';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const mainPort = DEFAULT_PORT;
  const baseUrl = process.env.BASE_URL || `http://localhost:${mainPort}`;

  await app.listen(mainPort, '0.0.0.0');
  console.log(`HTTP Server is running on port ${mainPort}`);

  // Prisma получаем один раз — не на каждый UDP-пакет
  const prisma = app.get(PrismaService);

  const udpServer = dgram.createSocket('udp4');

  udpServer.on('error', (err) => {
    console.error(`[UDP] Server error:\n${err.stack}`);
    udpServer.close();
  });

  udpServer.on('message', (msg, rinfo) => {
    const message = msg.toString();

    if (!message.startsWith(PDF_ID_PREFIX)) {
      console.log(
        `[UDP] Unknown data from ${rinfo.address}:${rinfo.port}: ${message}`,
      );
      return;
    }

    const pdfId = message.replace(PDF_ID_PREFIX, '').trim();
    console.log(
      `[UDP] Ping for pdfId: ${pdfId} from ${rinfo.address}:${rinfo.port}`,
    );

    prisma.pdfRecord
      .update({ where: { id: pdfId }, data: { lastPingAt: new Date() } })
      .then((record) => {
        const pdfLink = `${baseUrl}/pdf/raw/${record.modifiedName}`;
        const responseMsg = Buffer.from(`${pdfLink}\n`);
        udpServer.send(responseMsg, rinfo.port, rinfo.address, (err) => {
          if (err) {
            console.error('[UDP] Error sending response:', err);
          } else {
            console.log(`[UDP] Sent link to ${rinfo.address}:${rinfo.port}`);
          }
        });
      })
      .catch((err) => {
        console.error('[UDP] Error updating record:', err);
        udpServer.send(
          Buffer.from(UDP_ERROR_RESPONSE),
          rinfo.port,
          rinfo.address,
        );
      });
  });

  udpServer.on('listening', () => {
    const address = udpServer.address();
    console.log(
      `UDP Server is listening on ${address.address}:${address.port}`,
    );
  });

  udpServer.bind(UDP_PORT);
}

bootstrap();
