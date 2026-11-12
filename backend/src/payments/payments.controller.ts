import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentQueryDto } from './dto/payment.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  @RequirePermission('payments.read')
  list(@CurrentUser() user: AuthUser, @Query() query: PaymentQueryDto) {
    return this.payments.list(user, query);
  }

  @Post()
  @RequirePermission('payments.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, dto);
  }

  @Get('dues')
  @RequirePermission('payments.read')
  dues(@CurrentUser() user: AuthUser, @Query() query: PaymentQueryDto) {
    return this.payments.dues(user, query);
  }

  @Get('reports/summary')
  @RequirePermission('reports.read')
  report(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.payments.report(user, from, to);
  }

  @Get(':id/invoice')
  @RequirePermission('payments.read')
  invoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.getInvoiceForPayment(user, id);
  }

  @Post(':id/whatsapp')
  @RequirePermission('payments.write')
  sendWhatsApp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.sendPaymentWhatsApp(user, id);
  }
}
