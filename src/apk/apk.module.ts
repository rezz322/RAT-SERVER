import { Module } from '@nestjs/common';
import { ApkController } from './apk.controller';
import { ApkService } from './apk.service';
import { ApkInjectorService } from '../apk-injector.service';

@Module({
  controllers: [ApkController],
  providers: [ApkService, ApkInjectorService],
})
export class ApkModule {}
