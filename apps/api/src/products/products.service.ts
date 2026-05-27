import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Database, Product } from "../domain";
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
    const search = query.q?.trim().toLowerCase();
    const products = data.products.map((product) => this.withStock(product, reservedByProduct.get(product.id) ?? 0)).filter((product) => {
      if (query.categoryId && product.categoryId !== query.categoryId) {
        return false;
      }

      if (query.tag && !product.tags.includes(query.tag)) {
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
    const product = data.products.find((item) => item.id === id);

    if (!product) {
      throw new NotFoundException("Produto nao encontrado");
    }

    if (changed) {
      await this.store.write(data);
    }

    return this.withStock(product, reservedByProduct.get(product.id) ?? 0);
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
      tags: stringList(body.tags),
      categoryId,
      active: booleanValue(body.active, true),
      recommended: booleanValue(body.recommended, false),
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

    product.tags = body.tags === undefined ? product.tags : stringList(body.tags);
    product.active = booleanValue(body.active, product.active);
    product.recommended = booleanValue(body.recommended, Boolean(product.recommended));
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

  private withStock(product: Product, reservedQuantity = 0) {
    return {
      ...product,
      stock: Math.max(0, Math.floor(Number(product.stock ?? 0)) - reservedQuantity),
      photoUrls: product.photoUrls?.length ? product.photoUrls : [product.photoUrl].filter(Boolean)
    };
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
        if (!item.productId) {
          continue;
        }

        reservedByProduct.set(item.productId, (reservedByProduct.get(item.productId) ?? 0) + item.quantity);
      }
    }

    return reservedByProduct;
  }

  private normalizePhotoUrls(photoUrlsInput: unknown, fallbackPhotoUrl: unknown) {
    const photoUrls = urlList(photoUrlsInput);
    const fallback = requiredString(fallbackPhotoUrl, "photoUrl");
    const urls = photoUrls.length ? photoUrls : [fallback];
    return Array.from(new Set(urls));
  }
}
