import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Header,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';

/**
 * ZKTeco ADMS / iclock protocol endpoints.
 * Devices hit these without JWT — identified by SN query param.
 */
@ApiTags('iClock / ZKTeco ADMS')
@ApiExcludeController(false)
@Public()
@Controller('iclock')
export class IclockController {
  constructor(private attendance: AttendanceService) {}

  @Get('cdata')
  @Header('Content-Type', 'text/plain')
  async cdataGet(
    @Query('SN') sn: string,
    @Query('options') options: string,
    @Res() res: Response,
  ) {
    if (sn) await this.attendance.touchDevice(sn);
    // Initial handshake / options request
    if (options === 'all') {
      return res.send(
        [
          'GET OPTION FROM: ' + (sn || ''),
          'Stamp=9999',
          'OpStamp=9999',
          'PhotoStamp=9999',
          'ErrorDelay=30',
          'Delay=10',
          'TransTimes=00:00;14:00',
          'TransInterval=1',
          'TransFlag=1111000000',
          'TimeZone=5',
          'Realtime=1',
          'Encrypt=0',
        ].join('\n'),
      );
    }
    return res.send('OK');
  }

  @Post('cdata')
  @Header('Content-Type', 'text/plain')
  async cdataPost(
    @Query('SN') sn: string,
    @Query('table') table: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    let body = '';
    if (Buffer.isBuffer(req.body)) body = req.body.toString('utf8');
    else if (typeof req.body === 'string') body = req.body;
    else if (req.body != null) body = String(req.body);

    if (table === 'ATTLOG' || !table) {
      await this.attendance.ingestAttLogs(sn, body);
    }
    return res.send('OK');
  }

  @Get('getrequest')
  @Header('Content-Type', 'text/plain')
  async getrequest(@Query('SN') sn: string, @Res() res: Response) {
    const cmds = await this.attendance.getDeviceCommands(sn || '');
    return res.send(cmds);
  }

  @Post('devicecmd')
  @Header('Content-Type', 'text/plain')
  async devicecmd(
    @Query('SN') sn: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Device acknowledges executed commands
    if (sn) await this.attendance.touchDevice(sn);
    void req;
    return res.send('OK');
  }
}
