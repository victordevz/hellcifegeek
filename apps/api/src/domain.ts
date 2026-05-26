export type UserRole = "client" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
};

export type PublicUser = Omit<User, "passwordHash">;

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  stock: number;
  currency: "BRL";
  photoUrl: string;
  photoUrls: string[];
  tags: string[];
  categoryId: string;
  active: boolean;
  recommended: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Database = {
  users: User[];
  categories: Category[];
  products: Product[];
};

export type RequestUser = {
  id: string;
  role: UserRole;
  email: string;
};
