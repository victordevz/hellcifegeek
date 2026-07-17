import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

type UploadInput = {
  fileName?: string;
  contentType?: string;
  base64?: string;
};

export const PRODUCT_IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 365;
export const PRODUCT_IMAGE_MAX_DIMENSION = 1600;
export const PRODUCT_IMAGE_WEBP_QUALITY = 82;

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
    const base64 = this.extractBase64(input.base64);
    const bytes = Buffer.from(base64, "base64");
    let optimizedImage: Buffer;

    try {
      optimizedImage = await sharp(bytes)
        .rotate()
        .resize({
          width: PRODUCT_IMAGE_MAX_DIMENSION,
          height: PRODUCT_IMAGE_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: PRODUCT_IMAGE_WEBP_QUALITY, effort: 4 })
        .toBuffer();
    } catch {
      throw new BadRequestException("Imagem invalida ou corrompida.");
    }

    const path = `products/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;

    const { error } = await client.storage.from(this.bucket).upload(path, optimizedImage, {
      contentType: "image/webp",
      // Product images receive a unique UUID path and are never overwritten, so
      // browsers and the Supabase CDN can safely retain them for a long time.
      cacheControl: String(PRODUCT_IMAGE_CACHE_SECONDS),
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

}
