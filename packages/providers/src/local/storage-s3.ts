import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StorageProvider } from "@content-os/core";

/** S3-kompatibler Storage (Cloudflare R2, MinIO, AWS S3). */
export class S3Storage implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;
  constructor(private readonly cfg: { endpoint?: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string; cacheDir?: string }) {
    this.client = new S3Client({ region: cfg.region, endpoint: cfg.endpoint, forcePathStyle: !!cfg.endpoint, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } });
  }
  async put(key: string, data: Buffer, mimeType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: mimeType }));
    return { key, url: this.cfg.publicBaseUrl ? `${this.cfg.publicBaseUrl}/${key}` : undefined, sizeBytes: data.length };
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async localPath(key: string) {
    const dir = join(this.cfg.cacheDir ?? tmpdir(), "content-os-cache");
    await mkdir(dir, { recursive: true });
    const p = join(dir, key.replace(/[\/]/g, "__"));
    await writeFile(p, await this.get(key));
    return p;
  }
  async exists(key: string) { try { await this.client.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key })); return true; } catch { return false; } }
  async delete(key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key })); }
}
