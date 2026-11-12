import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageAdapter, StoredFile } from './storage.interface';

/**
 * S3-compatible adapter interface implementation (stub-ready).
 * Wire AWS SDK / MinIO client when credentials are present.
 * For production, install @aws-sdk/client-s3 and implement putObject/deleteObject.
 */
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('S3_ENDPOINT') || '';
    this.bucket = this.config.get<string>('S3_BUCKET') || '';
    this.region = this.config.get<string>('S3_REGION') || 'us-east-1';
    this.logger.warn(
      'S3StorageAdapter active — implement AWS SDK putObject for production uploads',
    );
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<StoredFile> {
    // Placeholder: persist locally-named S3 key metadata until SDK is wired
    this.logger.debug(`S3 upload stub: s3://${this.bucket}/${key} (${buffer.length} bytes)`);
    return {
      key,
      url: this.getUrl(key),
      mimeType,
      size: buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    this.logger.debug(`S3 delete stub: ${key}`);
  }

  getUrl(key: string): string {
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
