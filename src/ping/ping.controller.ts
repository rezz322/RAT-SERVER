import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PingService } from './ping.service';

@Controller('api')
export class PingController {
  constructor(private readonly pingService: PingService) {}

  @Post('ping')
  async ping(@Body() body: any, @Req() req: any) {
    console.log('Received ping from Android app:', {
      body,
      headers: req.headers,
    });
    return this.pingService.handlePing(body);
  }

  @Get('status')
  async status() {
    return this.pingService.getStatus();
  }
}
