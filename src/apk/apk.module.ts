import { Module } from '@nestjs/common';
import { ApkService } from './apk.service';
import { ApkInjectorService } from './apk-injector.service';

@Module({
  providers: [ApkService, ApkInjectorService],
  exports: [ApkService],
})
export class ApkModule {}
