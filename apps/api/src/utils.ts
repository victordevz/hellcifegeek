import { BadRequestException } from "@nestjs/common";

export function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} obrigatorio`);
  }

  return value.trim();
}

export function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function requiredNumber(value: unknown, field: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`${field} invalido`);
  }

  return parsed;
}

export function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export function urlList(value: unknown) {
  return stringList(value);
}

export function booleanValue(value: unknown, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return Boolean(value);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
