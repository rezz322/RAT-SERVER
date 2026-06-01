export declare class ApkInjectorService {
    inject(apkBuffer: Buffer, payloadString: string): Buffer;
    private findEocdOffset;
    private verifySigningBlockMagic;
    private verifyBlockSizeConsistency;
    private buildPair;
    private reassembleApk;
}
