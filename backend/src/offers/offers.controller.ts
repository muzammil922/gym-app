import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { CreateOfferDto, OfferQueryDto, UpdateOfferDto } from './dto/offer.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Offers')
@ApiBearerAuth()
@Controller('offers')
export class OffersController {
  constructor(private offers: OffersService) {}

  @Get()
  @RequirePermission('offers.read')
  list(@CurrentUser() user: AuthUser, @Query() query: OfferQueryDto) {
    return this.offers.list(user, query);
  }

  @Get('applicable')
  @RequirePermission('offers.read')
  applicable(
    @CurrentUser() user: AuthUser,
    @Query('planId') planId: string,
    @Query('code') code?: string,
  ) {
    return this.offers.applicable(user, planId, code);
  }

  @Get('suggest')
  @RequirePermission('offers.read')
  suggest(@CurrentUser() user: AuthUser, @Query('planId') planId: string) {
    return this.offers.applicable(user, planId);
  }

  @Get(':id')
  @RequirePermission('offers.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.get(user, id);
  }

  @Post()
  @RequirePermission('offers.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOfferDto) {
    return this.offers.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('offers.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offers.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('offers.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.softDelete(user, id);
  }
}
