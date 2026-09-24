import { mkdir, readFile, writeFile, stat, unlink, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { StorageProvider } from "@content-os/core";

/** Dateisystem-Storage (Dev/Test). Keys sind relative Pfade unterhalb des Root-Verzeichnisses. */
export class LocalStorage implements StorageProvider {
  readonly name = "local";
  private readonly root: string;
  constructor(root: string) { this.root = resolve(root); }

  private p(key: string): string {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root)) throw new Error(`Ungültiger Storage-Key: ${key}`);
    return full;
  }
  async put(key: string, data: Buffer, _mimeType: string) {
    const full = this.p(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key, url: `file://${full}`, sizeBytes: data.length };
  }
  async get(key: string) { return readFile(this.p(key)); }
  async localPath(key: string) { return this.p(key); }
  async exists(key: string) { try { await access(this.p(key)); return true; } catch { return false; } }
  async delete(key: string) { try { await unlink(this.p(key)); } catch { /* ignore */ } }
  async size(key: string) { return (await stat(this.p(key))).size; }
}
