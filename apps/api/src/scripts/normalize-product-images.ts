import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { PRODUCT_IMAGE_CACHE_SECONDS, PRODUCT_IMAGE_MAX_DIMENSION, PRODUCT_IMAGE_WEBP_QUALITY } from "../supabase/supabase.service";

type Product = {
  photoUrl?: string;
  photoUrls?: string[];
  variations?: Array<{ photoUrl?: string }>;
};

type ProductImageState = {
  products?: Product[];
};

type StateRow = {
  data: ProductImageState;
};

function storagePathFor(url: string, supabaseUrl: string, bucket: string) {
  try {
    const publicUrl = new URL(url);
    const projectUrl = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${bucket}/`;

    if (publicUrl.origin !== projectUrl.origin || !publicUrl.pathname.startsWith(prefix)) {
      return null;
    }

    return decodeURIComponent(publicUrl.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "images";
  const stateTable = process.env.SUPABASE_STATE_TABLE ?? "app_state";
  const stateId = process.env.SUPABASE_STATE_ID ?? "main";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await client
    .from(stateTable)
    .select("data")
    .eq("id", stateId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Falha ao ler produtos: ${error?.message ?? "estado ausente"}`);
  }

  const state = data as StateRow;
  const normalizedUrls = new Map<string, Promise<string>>();
  let converted = 0;

  const normalizeUrl = (url: string) => {
    const existing = normalizedUrls.get(url);

    if (existing) {
      return existing;
    }

    const task = (async () => {
      const sourcePath = storagePathFor(url, supabaseUrl, bucket);

      if (!sourcePath || sourcePath.startsWith("products/optimized/")) {
        return url;
      }

      const { data: file, error: downloadError } = await client.storage.from(bucket).download(sourcePath);

      if (downloadError || !file) {
        throw new Error(`Falha ao baixar ${sourcePath}: ${downloadError?.message ?? "arquivo ausente"}`);
      }

      const source = Buffer.from(await file.arrayBuffer());
      const optimized = await sharp(source)
        .rotate()
        .resize({
          width: PRODUCT_IMAGE_MAX_DIMENSION,
          height: PRODUCT_IMAGE_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: PRODUCT_IMAGE_WEBP_QUALITY, effort: 4 })
        .toBuffer();
      const outputPath = `products/optimized/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.webp`;
      const { error: uploadError } = await client.storage.from(bucket).upload(outputPath, optimized, {
        contentType: "image/webp",
        cacheControl: String(PRODUCT_IMAGE_CACHE_SECONDS),
        upsert: false
      });

      if (uploadError) {
        throw new Error(`Falha ao enviar ${outputPath}: ${uploadError.message}`);
      }

      const { data: publicUrl } = client.storage.from(bucket).getPublicUrl(outputPath);
      converted += 1;
      console.log(`Normalizada ${converted}: ${sourcePath}`);
      return publicUrl.publicUrl;
    })();

    normalizedUrls.set(url, task);
    return task;
  };

  for (const product of state.data.products ?? []) {
    const sources = product.photoUrls?.length ? product.photoUrls : [product.photoUrl].filter((url): url is string => Boolean(url));
    const photoUrls = await Promise.all(sources.map(normalizeUrl));

    if (photoUrls.length) {
      product.photoUrls = photoUrls;
      product.photoUrl = photoUrls[0];
    }

    for (const variation of product.variations ?? []) {
      if (variation.photoUrl) {
        variation.photoUrl = await normalizeUrl(variation.photoUrl);
      }
    }
  }

  const { error: stateError } = await client
    .from(stateTable)
    .update({ data: state.data, updated_at: new Date().toISOString() })
    .eq("id", stateId);

  if (stateError) {
    throw new Error(`Falha ao atualizar produtos: ${stateError.message}`);
  }

  console.log(`Normalizacao concluida: ${converted} imagem(ns) convertida(s) para WebP.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
