import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { StorageAdapter, StoredFile } from './storage.interface';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly basePath: string;
  private readonly appUrl: string;

  constructor(private config: ConfigService) {
    this.basePath = path.resolve(
      this.config.get<string>('STORAGE_LOCAL_PATH') || './uploads',
    );
    this.appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<StoredFile> {
    const full = path.join(this.basePath, key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buffer);
    return {
      key,
      url: this.getUrl(key),
      mimeType,
      size: buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    const full = path.join(this.basePath, key);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }

  getUrl(key: string): string {
    return `${this.appUrl}/uploads/${key.replace(/\\/g, '/')}`;
  }
}
