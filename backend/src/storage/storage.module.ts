import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageAdapter } from './storage.interface';

export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';

@Global()
@Module({
  providers: [
    LocalStorageAdapter,
    S3StorageAdapter,
    CloudinaryStorageAdapter,
    {
      provide: STORAGE_ADAPTER,
      inject: [
        ConfigService,
        LocalStorageAdapter,
        S3StorageAdapter,
        CloudinaryStorageAdapter,
      ],
      useFactory: (
        config: ConfigService,
        local: LocalStorageAdapter,
        s3: S3StorageAdapter,
        cloudinary: CloudinaryStorageAdapter,
      ): StorageAdapter => {
        const driver = (config.get<string>('STORAGE_DRIVER') || 'local').toLowerCase();
        if (driver === 's3') return s3;
        if (driver === 'cloudinary') return cloudinary;
        return local;
      },
    },
  ],
  exports: [STORAGE_ADAPTER, LocalStorageAdapter],
})
export class StorageModule {}
