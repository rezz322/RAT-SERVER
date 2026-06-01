import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class ApkInjectorService {
  /**
   * Injects a custom string payload into the APK Signature Block v2.
   * This does not break the signature because Android ignores unknown IDs.
   * 
   * @param apkBuffer The original APK file buffer
   * @param payloadString The string to inject (e.g. "pdf_id=123")
   * @returns A new Buffer containing the modified APK
   */
  inject(apkBuffer: Buffer, payloadString: string): Buffer {
    // 1. Find EOCD (End of Central Directory)
    let eocdOffset = -1;
    // EOCD magic is 0x06054b50 (little endian: 50 4b 05 06)
    // Min size of EOCD is 22 bytes.
    for (let i = apkBuffer.length - 22; i >= 0; i--) {
      if (apkBuffer.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    
    if (eocdOffset === -1) {
      throw new HttpException("EOCD not found. Not a valid ZIP file.", HttpStatus.BAD_REQUEST);
    }

    // 2. Read Central Directory Offset
    const cdOffset = apkBuffer.readUInt32LE(eocdOffset + 16);

    // 3. Verify APK Signing Block magic
    const magic = apkBuffer.toString('ascii', cdOffset - 16, cdOffset);
    if (magic !== 'APK Sig Block 42') {
      throw new HttpException("APK Signing Block V2 not found. The APK must be v2 signed.", HttpStatus.BAD_REQUEST);
    }

    // 4. Read Block Size (uint64 little endian)
    // We only need the low 32 bits since block size usually won't exceed a few MBs
    const blockSizeLow = apkBuffer.readUInt32LE(cdOffset - 24);
    const blockStartOffset = cdOffset - (blockSizeLow + 8);
    
    // Verify top block size matches bottom block size
    const topBlockSizeLow = apkBuffer.readUInt32LE(blockStartOffset);
    if (topBlockSizeLow !== blockSizeLow) {
       throw new HttpException("APK Signing Block size mismatch. File might be corrupted.", HttpStatus.BAD_REQUEST);
    }

    // 5. Construct new ID-Value Pair
    const payloadBuffer = Buffer.from(payloadString, 'utf8');
    // Pair structure: 8 bytes size + 4 bytes ID + payload
    // Size field itself is not included in the pair size, so size = 4 + payload.length
    const pairSize = payloadBuffer.length + 4;
    
    const newPairBuffer = Buffer.alloc(8 + 4 + payloadBuffer.length);
    newPairBuffer.writeUInt32LE(pairSize, 0); // low 32 bits of uint64
    newPairBuffer.writeUInt32LE(0, 4);        // high 32 bits of uint64
    newPairBuffer.writeUInt32LE(0x71717171, 8); // Custom ID for our payload
    payloadBuffer.copy(newPairBuffer, 12);

    const insertionLength = newPairBuffer.length;
    const newBlockSizeLow = blockSizeLow + insertionLength;

    // 6. Build the new APK buffer by splitting and reassembling
    
    // Part 1: From start of file to the end of existing ID-Value pairs
    // This includes the ZIP contents and the top block size.
    const part1 = Buffer.alloc(cdOffset - 24);
    apkBuffer.copy(part1, 0, 0, cdOffset - 24);
    // Update the top block size
    part1.writeUInt32LE(newBlockSizeLow, blockStartOffset); 
    
    // Part 2: The new injected Pair
    const part2 = newPairBuffer;

    // Part 3: The bottom block size and magic (24 bytes)
    const part3 = Buffer.alloc(24);
    apkBuffer.copy(part3, 0, cdOffset - 24, cdOffset);
    // Update the bottom block size
    part3.writeUInt32LE(newBlockSizeLow, 0);

    // Part 4: Central Directory and EOCD
    const part4 = Buffer.alloc(apkBuffer.length - cdOffset);
    apkBuffer.copy(part4, 0, cdOffset, apkBuffer.length);
    // Update Central Directory Offset in EOCD
    const newCdOffset = cdOffset + insertionLength;
    const localEocdOffset = eocdOffset - cdOffset;
    part4.writeUInt32LE(newCdOffset, localEocdOffset + 16);

    return Buffer.concat([part1, part2, part3, part4]);
  }
}
