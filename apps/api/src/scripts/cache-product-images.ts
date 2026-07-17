import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PRODUCT_IMAGE_CACHE_SECONDS } from "../supabase/supabase.service";

type ProductImageState = {
  products?: Array<{
    photoUrl?: string;
    photoUrls?: string[];
    variations?: Array<{ photoUrl?: string }>;
  }>;
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

  if (error) {
    throw new Error(`Falha ao ler produtos: ${error.message}`);
  }

  const state = data as StateRow | null;
  const imageUrls = (state?.data.products ?? []).flatMap((product) => [
    product.photoUrl,
    ...(product.photoUrls ?? []),
    ...(product.variations ?? []).map((variation) => variation.photoUrl)
  ]).filter((url): url is string => Boolean(url));
  const paths = Array.from(new Set(imageUrls.map((url) => storagePathFor(url, supabaseUrl, bucket)).filter((path): path is string => Boolean(path))));

  let updated = 0;

  for (const path of paths) {
    const { data: file, error: downloadError } = await client.storage.from(bucket).download(path);

    if (downloadError || !file) {
      throw new Error(`Falha ao baixar ${path}: ${downloadError?.message ?? "arquivo ausente"}`);
    }

    const { error: updateError } = await client.storage.from(bucket).update(path, file, {
      cacheControl: String(PRODUCT_IMAGE_CACHE_SECONDS),
      contentType: file.type || undefined
    });

    if (updateError) {
      throw new Error(`Falha ao atualizar cache de ${path}: ${updateError.message}`);
    }

    updated += 1;
  }

  console.log(`Cache atualizado para ${updated} imagem(ns) de produto.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
