import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../queues/queue.constants';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppProcessor } from './whatsapp.processor';
import { MetaCloudWhatsAppProvider } from './providers/meta-cloud.provider';
import { EvolutionWhatsAppProvider } from './providers/evolution.provider';
import { whatsAppProviderFactory } from './whatsapp-provider.factory';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.WHATSAPP })],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppProcessor,
    MetaCloudWhatsAppProvider,
    EvolutionWhatsAppProvider,
    whatsAppProviderFactory,
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
