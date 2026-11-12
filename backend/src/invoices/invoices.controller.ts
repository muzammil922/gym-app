import { Controller, Get, Header, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Get()
  @RequirePermission('invoices.read')
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto & { status?: string; memberId?: string },
  ) {
    return this.invoices.list(user, query);
  }

  @Get(':id')
  @RequirePermission('invoices.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.get(user, id);
  }

  @Get(':id/pdf')
  @RequirePermission('invoices.read')
  @Header('Content-Type', 'application/pdf')
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, url } = await this.invoices.generatePdf(user, id);
    res.set({
      'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
      'X-Pdf-Url': url,
    });
    return new StreamableFile(buffer);
  }
}
