import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

@ApiTags('Health')
@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica se a API está no ar' })
  @ApiOkResponse({ description: 'API funcionando', type: String })
  getHello(): string {
    return this.appService.getHello();
  }

  // TEMPORÁRIO: diagnóstico do TRUST_PROXY no Render. Remover após o teste.
  @Get('debug-ip')
  @ApiExcludeEndpoint()
  debugIp(@Req() req: Request) {
    const h = req.headers;
    return {
      ip: req.ip,
      ips: req.ips,
      remote: req.socket.remoteAddress,
      xff: h['x-forwarded-for'],
      true_client_ip: h['true-client-ip'],
      cf_connecting_ip: h['cf-connecting-ip'],
      x_real_ip: h['x-real-ip'],
    };
  }
}
