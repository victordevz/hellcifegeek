import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type UploadInput = {
  fileName?: string;
  contentType?: string;
  base64?: string;
};

@Injectable()
export class SupabaseService {
  private readonly bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "images";
  private readonly client: SupabaseClient | null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.client = url && key ? createClient(url, key) : null;
  }

  async storageStatus() {
    const client = this.requireClient();
    const { data, error } = await client.storage.listBuckets();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }

    const bucket = data.find((item) => item.name.toLowerCase() === this.bucket.toLowerCase());

    return {
      configured: true,
      bucket: this.bucket,
      exists: Boolean(bucket),
      public: Boolean(bucket?.public)
    };
  }

  async uploadProductImage(input: UploadInput) {
    const client = this.requireClient();
    const contentType = input.contentType?.trim() || "image/png";
    const base64 = this.extractBase64(input.base64);
    const extension = this.extensionFor(input.fileName, contentType);
    const path = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const bytes = Buffer.from(base64, "base64");

    const { error } = await client.storage.from(this.bucket).upload(path, bytes, {
      contentType,
      upsert: false
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const { data } = client.storage.from(this.bucket).getPublicUrl(path);

    return {
      bucket: this.bucket,
      path,
      publicUrl: data.publicUrl
    };
  }

  private requireClient() {
    if (!this.client) {
      throw new ServiceUnavailableException("Supabase nao configurado");
    }

    return this.client;
  }

  private extractBase64(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("base64 obrigatorio");
    }

    const [, payload] = value.split(",");
    return payload ?? value;
  }

  private extensionFor(fileName: unknown, contentType: string) {
    if (typeof fileName === "string" && fileName.includes(".")) {
      return fileName.split(".").pop()?.toLowerCase() || "png";
    }

    if (contentType.includes("jpeg")) {
      return "jpg";
    }

    if (contentType.includes("webp")) {
      return "webp";
    }

    if (contentType.includes("avif")) {
      return "avif";
    }

    return "png";
  }
}
