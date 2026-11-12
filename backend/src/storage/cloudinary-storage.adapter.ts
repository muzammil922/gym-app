import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { StorageAdapter, StoredFile } from './storage.interface';

@Injectable()
export class CloudinaryStorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(CloudinaryStorageAdapter.name);
  private readonly folder: string;

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('CLOUDINARY_URL');
    if (url) {
      const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/]+)$/);
      if (m) {
        cloudinary.config({
          api_key: m[1],
          api_secret: m[2],
          cloud_name: m[3],
          secure: true,
        });
      } else {
        this.logger.warn('CLOUDINARY_URL format invalid — use cloudinary://KEY:SECRET@CLOUD_NAME');
      }
    } else {
      cloudinary.config({
        cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
        api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
        api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
        secure: true,
      });
    }
    this.folder = (this.config.get<string>('CLOUDINARY_FOLDER') || 'gym').replace(
      /\/+$/,
      '',
    );
  }

  private uploadBuffer(
    buffer: Buffer,
    key: string,
    mimeType?: string,
  ): Promise<UploadApiResponse> {
    const resourceType = mimeType?.startsWith('video/') ? 'video' : 'image';
    const publicId = key.replace(/\.[^.]+$/, '').replace(/\\/g, '/');

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: this.folder,
          public_id: publicId,
          resource_type: resourceType,
          overwrite: true,
        },
        (err, result) => {
          if (err || !result) {
            reject(err ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result);
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<StoredFile> {
    const result = await this.uploadBuffer(buffer, key, mimeType);
    this.logger.debug(`Cloudinary upload: ${result.public_id}`);
    return {
      key: result.public_id,
      url: result.secure_url,
      mimeType: mimeType ?? result.resource_type,
      size: buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    const publicId = key.replace(/\\/g, '/');
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    }
  }

  getUrl(key: string): string {
    return cloudinary.url(key.replace(/\\/g, '/'), { secure: true });
  }
}
