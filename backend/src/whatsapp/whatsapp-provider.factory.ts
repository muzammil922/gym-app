import { ConfigService } from '@nestjs/config';
import { WHATSAPP_PROVIDER } from './whatsapp.constants';
import { EvolutionWhatsAppProvider } from './providers/evolution.provider';
import { MetaCloudWhatsAppProvider } from './providers/meta-cloud.provider';

export const whatsAppProviderFactory = {
  provide: WHATSAPP_PROVIDER,
  useFactory: (
    config: ConfigService,
    meta: MetaCloudWhatsAppProvider,
    evolution: EvolutionWhatsAppProvider,
  ) => {
    const kind = (config.get<string>('WHATSAPP_PROVIDER') || 'meta').toLowerCase();
    return kind === 'evolution' ? evolution : meta;
  },
  inject: [ConfigService, MetaCloudWhatsAppProvider, EvolutionWhatsAppProvider],
};
