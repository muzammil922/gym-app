import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Public, RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private wa: WhatsAppService) {}

  @ApiBearerAuth()
  @Get('templates')
  @RequirePermission('whatsapp.read')
  templates(@CurrentUser() user: AuthUser) {
    return this.wa.listTemplates(user);
  }

  @ApiBearerAuth()
  @Put('templates')
  @RequirePermission('whatsapp.write')
  upsertTemplate(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      key: string;
      name: string;
      body: string;
      language?: string;
      metaTplId?: string;
      variables?: Record<string, unknown>;
    },
  ) {
    return this.wa.upsertTemplate(user, body);
  }

  @ApiBearerAuth()
  @Get('automation')
  @RequirePermission('whatsapp.read')
  automation(@CurrentUser() user: AuthUser) {
    return this.wa.listAutomation(user);
  }

  @ApiBearerAuth()
  @Put('automation/:key')
  @RequirePermission('whatsapp.write')
  setAutomation(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() body: { enabled: boolean; config?: Record<string, unknown> },
  ) {
    return this.wa.setAutomation(user, key, body.enabled, body.config);
  }

  @ApiBearerAuth()
  @Get('settings')
  @RequirePermission('whatsapp.read')
  settings(@CurrentUser() user: AuthUser) {
    return this.wa.getSettings(user);
  }

  @ApiBearerAuth()
  @Put('settings')
  @RequirePermission('whatsapp.write')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, boolean | undefined>,
  ) {
    return this.wa.updateSettings(user, body);
  }

  @ApiBearerAuth()
  @Get('messages')
  @RequirePermission('whatsapp.read')
  messages(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const size = Number(pageSize || limit) || 20;
    return this.wa.listMessages(user, Number(page) || 1, size);
  }

  @ApiBearerAuth()
  @Get('connection')
  @RequirePermission('whatsapp.read')
  connection() {
    return this.wa.getConnection();
  }

  @ApiBearerAuth()
  @Post('connection/connect')
  @RequirePermission('whatsapp.write')
  connect() {
    return this.wa.connectInstance();
  }

  @ApiBearerAuth()
  @Post('connect')
  @RequirePermission('whatsapp.write')
  connectAlias() {
    return this.wa.connectInstance();
  }

  @ApiBearerAuth()
  @Get('logs')
  @RequirePermission('whatsapp.read')
  logs(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wa.listLogs(user, Number(page) || 1, Number(limit) || 20);
  }

  @ApiBearerAuth()
  @Post('retry/:queueId')
  @RequirePermission('whatsapp.write')
  retry(@CurrentUser() user: AuthUser, @Param('queueId') queueId: string) {
    return this.wa.retry(user, queueId);
  }

  @ApiBearerAuth()
  @Get('cost')
  @RequirePermission('whatsapp.read')
  cost(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.wa.costEstimate(user, from, to);
  }

  @ApiBearerAuth()
  @Post('send')
  @RequirePermission('whatsapp.write')
  send(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      toPhone: string;
      body: string;
      templateKey?: string;
      idempotencyKey?: string;
    },
  ) {
    return this.wa.enqueue({
      gymId: user.gymId,
      toPhone: body.toPhone,
      body: body.body,
      templateKey: body.templateKey,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Public()
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = this.wa.verifyWebhook(mode, token, challenge);
    if (result === null) return res.status(403).send('Forbidden');
    return res.status(200).send(result);
  }

  @Public()
  @Post('webhook')
  webhook(@Body() body: unknown) {
    return this.wa.handleWebhook(body);
  }
}
