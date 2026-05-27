export type UserRole = "client" | "admin" | "partner";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  hellpoints: number;
  raffleTickets: number;
  banned: boolean;
  partnerCouponCode?: string;
  partnerDiscountPercent?: number;
  partnerSince?: string;
  termsAcceptedAt?: string;
  privacyAcceptedAt?: string;
  marketingEmailsOptIn?: boolean;
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

export type PartnerPurchaseItem = {
  productId?: string;
  name: string;
  quantity: number;
  priceCents: number;
};

export type PartnerPurchase = {
  id: string;
  partnerId: string;
  customerId: string;
  customerName?: string;
  customerEmail: string;
  couponCode: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  items: PartnerPurchaseItem[];
  status: "whatsapp_opened";
  createdAt: string;
};

export type Database = {
  users: User[];
  categories: Category[];
  products: Product[];
  partnerPurchases: PartnerPurchase[];
};

export type RequestUser = {
  id: string;
  role: UserRole;
  email: string;
};
