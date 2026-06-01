"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const dgram = __importStar(require("dgram"));
const prisma_service_1 = require("./prisma.service");
const DEFAULT_PORT = 8080;
const PDF_ID_PREFIX = 'pdf_id=';
const UDP_ERROR_RESPONSE = 'ERROR\n';
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    const mainPort = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_PORT;
    const baseUrl = process.env.BASE_URL || `http://localhost:${mainPort}`;
    await app.listen(mainPort, '0.0.0.0');
    console.log(`HTTP Server is running on port ${mainPort}`);
    const prisma = app.get(prisma_service_1.PrismaService);
    const udpServer = dgram.createSocket('udp4');
    udpServer.on('error', (err) => {
        console.error(`[UDP] Server error:\n${err.stack}`);
        udpServer.close();
    });
    udpServer.on('message', (msg, rinfo) => {
        const message = msg.toString();
        if (!message.startsWith(PDF_ID_PREFIX)) {
            console.log(`[UDP] Unknown data from ${rinfo.address}:${rinfo.port}: ${message}`);
            return;
        }
        const pdfId = message.replace(PDF_ID_PREFIX, '').trim();
        console.log(`[UDP] Ping for pdfId: ${pdfId} from ${rinfo.address}:${rinfo.port}`);
        prisma.pdfRecord
            .update({ where: { id: pdfId }, data: { lastPingAt: new Date() } })
            .then((record) => {
            const pdfLink = `${baseUrl}/pdf/raw/${record.modifiedName}`;
            const responseMsg = Buffer.from(`${pdfLink}\n`);
            udpServer.send(responseMsg, rinfo.port, rinfo.address, (err) => {
                if (err) {
                    console.error('[UDP] Error sending response:', err);
                }
                else {
                    console.log(`[UDP] Sent link to ${rinfo.address}:${rinfo.port}`);
                }
            });
        })
            .catch((err) => {
            console.error('[UDP] Error updating record:', err);
            udpServer.send(Buffer.from(UDP_ERROR_RESPONSE), rinfo.port, rinfo.address);
        });
    });
    udpServer.on('listening', () => {
        const address = udpServer.address();
        console.log(`UDP Server is listening on ${address.address}:${address.port}`);
    });
    udpServer.bind(mainPort);
}
bootstrap();
//# sourceMappingURL=main.js.map