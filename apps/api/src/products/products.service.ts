import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Database, Product, ProductVariation } from "../domain";
import { JsonStoreService } from "../storage/json-store.service";
import { booleanValue, optionalString, requiredNumber, requiredString, stringList, urlList } from "../utils";

type ProductQuery = {
  categoryId?: string;
  tag?: string;
  q?: string;
  active?: string;
  recommended?: string;
};

@Injectable()
export class ProductsService {
  constructor(@Inject(JsonStoreService) private readonly store: JsonStoreService) {}

  async list(query: ProductQuery) {
    const data = await this.store.read();
    const changed = this.expireStaleReservations(data);
    const reservedByProduct = this.reservedQuantitiesByProduct(data);
    const reservedByItem = this.reservedQuantitiesByItem(data);
    const search = query.q?.trim().toLowerCase();
    const products = data.products.map((product) => this.withStock(product, reservedByProduct.get(product.id) ?? 0, reservedByItem)).filter((product) => {
      if (query.categoryId && product.categoryId !== query.categoryId) {
        return false;
      }

      if (query.tag && !product.tags.includes(query.tag.trim().toLowerCase())) {
        return false;
      }

      if (query.active !== undefined && String(product.active) !== query.active) {
        return false;
      }

      if (query.recommended !== undefined && String(Boolean(product.recommended)) !== query.recommended) {
        return false;
      }

      if (search && !`${product.name} ${product.description ?? ""}`.toLowerCase().includes(search)) {
        return false;
      }

      return true;
    });

    if (changed) {
      await this.store.write(data);
    }

    return products;
  }

  async get(id: string) {
    const data = await this.store.read();
    const changed = this.expireStaleReservations(data);
    const reservedByProduct = this.reservedQuantitiesByProduct(data);
    const reservedByItem = this.reservedQuantitiesByItem(data);
    const product = data.products.find((item) => item.id === id);

    if (!product) {
      throw new NotFoundException("Produto nao encontrado");
    }

    if (changed) {
      await this.store.write(data);
    }

    return this.withStock(product, reservedByProduct.get(product.id) ?? 0, reservedByItem);
  }

  async create(body: Record<string, unknown>) {
    const data = await this.store.read();
    const categoryId = requiredString(body.categoryId, "categoryId");

    if (!data.categories.some((category) => category.id === categoryId)) {
      throw new BadRequestException("Categoria invalida");
    }

    const price = requiredNumber(body.price, "price");
    const stock = Math.max(0, Math.floor(requiredNumber(body.stock, "stock")));
    const photoUrls = this.normalizePhotoUrls(body.photoUrls, body.photoUrl);
    const now = new Date().toISOString();
    const product: Product = {
      id: crypto.randomUUID(),
      name: requiredString(body.name, "name"),
      description: optionalString(body.description),
      priceCents: Math.round(price * 100),
      stock,
      currency: "BRL",
      photoUrl: photoUrls[0],
      photoUrls,
      tags: this.normalizeTags(body.tags),
      categoryId,
      active: booleanValue(body.active, true),
      recommended: booleanValue(body.recommended, false),
      variations: this.normalizeVariations(body.variations),
      createdAt: now,
      updatedAt: now
    };

    data.products.push(product);
    await this.store.write(data);
    return product;
  }

  async update(id: string, body: Record<string, unknown>) {
    const data = await this.store.read();
    const product = data.products.find((item) => item.id === id);

    if (!product) {
      throw new NotFoundException("Produto nao encontrado");
    }

    if (body.categoryId !== undefined) {
      const categoryId = requiredString(body.categoryId, "categoryId");

      if (!data.categories.some((category) => category.id === categoryId)) {
        throw new BadRequestException("Categoria invalida");
      }

      product.categoryId = categoryId;
    }

    product.name = body.name ? requiredString(body.name, "name") : product.name;
    product.description = body.description === undefined ? product.description : optionalString(body.description);
    if (body.photoUrls !== undefined || body.photoUrl !== undefined) {
      const photoUrls = this.normalizePhotoUrls(body.photoUrls, body.photoUrl ?? product.photoUrl);
      product.photoUrl = photoUrls[0];
      product.photoUrls = photoUrls;
    }

    product.tags = body.tags === undefined ? product.tags : this.normalizeTags(body.tags);
    product.active = booleanValue(body.active, product.active);
    product.recommended = booleanValue(body.recommended, Boolean(product.recommended));
    product.variations = body.variations === undefined ? product.variations : this.normalizeVariations(body.variations);
    product.priceCents = body.price === undefined ? product.priceCents : Math.round(requiredNumber(body.price, "price") * 100);
    product.stock = body.stock === undefined ? Math.max(0, Math.floor(Number(product.stock ?? 0))) : Math.max(0, Math.floor(requiredNumber(body.stock, "stock")));
    product.updatedAt = new Date().toISOString();

    await this.store.write(data);
    return product;
  }

  async setRecommended(id: string, recommended: boolean) {
    return this.update(id, { recommended });
  }

  async remove(id: string) {
    const data = await this.store.read();
    const product = data.products.find((item) => item.id === id);

    if (!product) {
      throw new NotFoundException("Produto nao encontrado");
    }

    data.products = data.products.filter((item) => item.id !== id);
    await this.store.write(data);
    return { removed: true };
  }

  private withStock(product: Product, reservedQuantity = 0, reservedByItem = new Map<string, number>()) {
    const variations = Array.isArray(product.variations)
      ? product.variations.map((variation) => ({
        ...variation,
        stock: variation.stock === undefined
          ? variation.stock
          : Math.max(0, Math.floor(Number(variation.stock ?? 0)) - (reservedByItem.get(this.inventoryItemKey(product.id, variation.id)) ?? 0))
      }))
      : [];

    return {
      ...product,
      stock: Math.max(0, Math.floor(Number(product.stock ?? 0)) - reservedQuantity),
      photoUrls: product.photoUrls?.length ? product.photoUrls : [product.photoUrl].filter(Boolean),
      variations
    };
  }

  private normalizeTags(value: unknown) {
    return Array.from(new Set(stringList(value).map((tag) => tag.toLowerCase())));
  }

  private expireStaleReservations(data: Database) {
    const now = Date.now();
    let changed = false;

    for (const reservation of data.inventoryReservations ?? []) {
      if (reservation.status === "active" && new Date(reservation.expiresAt).getTime() <= now) {
        reservation.status = "expired";
        changed = true;
      }
    }

    return changed;
  }

  private reservedQuantitiesByProduct(data: Database) {
    const reservedByProduct = new Map<string, number>();
    const now = Date.now();

    for (const reservation of data.inventoryReservations ?? []) {
      if (reservation.status !== "active" || new Date(reservation.expiresAt).getTime() <= now) {
        continue;
      }

      for (const item of reservation.items) {
        const product = data.products.find((entry) => entry.id === item.productId);
        const variation = item.variationId
          ? product?.variations?.find((entry) => entry.id === item.variationId)
          : undefined;

        if (!item.productId || variation?.stock !== undefined) {
          continue;
        }

        reservedByProduct.set(item.productId, (reservedByProduct.get(item.productId) ?? 0) + item.quantity);
      }
    }

    return reservedByProduct;
  }

  private reservedQuantitiesByItem(data: Database) {
    const reservedByItem = new Map<string, number>();
    const now = Date.now();

    for (const reservation of data.inventoryReservations ?? []) {
      if (reservation.status !== "active" || new Date(reservation.expiresAt).getTime() <= now) {
        continue;
      }

      for (const item of reservation.items) {
        const product = data.products.find((entry) => entry.id === item.productId);
        const variation = item.variationId
          ? product?.variations?.find((entry) => entry.id === item.variationId)
          : undefined;

        if (!item.productId || !item.variationId || variation?.stock === undefined) {
          continue;
        }

        const key = this.inventoryItemKey(item.productId, item.variationId);
        reservedByItem.set(key, (reservedByItem.get(key) ?? 0) + item.quantity);
      }
    }

    return reservedByItem;
  }

  private inventoryItemKey(productId: string, variationId: string) {
    return `product:${productId}:variation:${variationId}`;
  }

  private normalizePhotoUrls(photoUrlsInput: unknown, fallbackPhotoUrl: unknown) {
    const photoUrls = urlList(photoUrlsInput);
    const fallback = requiredString(fallbackPhotoUrl, "photoUrl");
    const urls = photoUrls.length ? photoUrls : [fallback];
    return Array.from(new Set(urls));
  }

  private normalizeVariations(value: unknown): ProductVariation[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const variations: ProductVariation[] = [];

    for (const item of value) {
      const entry = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      const name = optionalString(entry.name);

      if (!name) {
        continue;
      }

      const price = entry.price === undefined || entry.price === "" || entry.price === null
        ? undefined
        : Math.round(requiredNumber(entry.price, "variation.price") * 100);
      const stock = entry.stock === undefined || entry.stock === "" || entry.stock === null
        ? undefined
        : Math.max(0, Math.floor(requiredNumber(entry.stock, "variation.stock")));

      variations.push({
        id: optionalString(entry.id) ?? crypto.randomUUID(),
        name,
        priceCents: price,
        stock,
        photoUrl: optionalString(entry.photoUrl)
      });
    }

    return variations;
  }
}
