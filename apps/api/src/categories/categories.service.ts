import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Category } from "../domain";
import { JsonStoreService } from "../storage/json-store.service";
import { optionalString, requiredString, slugify } from "../utils";

@Injectable()
export class CategoriesService {
  constructor(@Inject(JsonStoreService) private readonly store: JsonStoreService) {}

  async list() {
    const data = await this.store.read();
    return data.categories;
  }

  async create(body: Record<string, unknown>) {
    const name = requiredString(body.name, "name");
    const slug = optionalString(body.slug) ?? slugify(name);
    const data = await this.store.read();

    if (data.categories.some((category) => category.slug === slug)) {
      throw new BadRequestException("Slug de categoria ja existe");
    }

    const now = new Date().toISOString();
    const category: Category = {
      id: crypto.randomUUID(),
      name,
      slug,
      description: optionalString(body.description),
      createdAt: now,
      updatedAt: now
    };

    data.categories.push(category);
    await this.store.write(data);
    return category;
  }

  async update(id: string, body: Record<string, unknown>) {
    const data = await this.store.read();
    const category = data.categories.find((item) => item.id === id);

    if (!category) {
      throw new NotFoundException("Categoria nao encontrada");
    }

    const nextSlug = optionalString(body.slug) ?? (body.name ? slugify(requiredString(body.name, "name")) : category.slug);

    if (nextSlug !== category.slug && data.categories.some((item) => item.slug === nextSlug)) {
      throw new BadRequestException("Slug de categoria ja existe");
    }

    category.name = body.name ? requiredString(body.name, "name") : category.name;
    category.slug = nextSlug;
    category.description = optionalString(body.description) ?? category.description;
    category.updatedAt = new Date().toISOString();

    await this.store.write(data);
    return category;
  }

  async remove(id: string) {
    const data = await this.store.read();
    const category = data.categories.find((item) => item.id === id);

    if (!category) {
      throw new NotFoundException("Categoria nao encontrada");
    }

    if (data.products.some((product) => product.categoryId === id)) {
      throw new BadRequestException("Categoria possui produtos vinculados");
    }

    data.categories = data.categories.filter((item) => item.id !== id);
    await this.store.write(data);
    return { removed: true };
  }
}
