export interface StoredFile {
  key: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface StorageAdapter {
  upload(
    key: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
