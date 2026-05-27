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

export type PartnerPurchaseStatus = "whatsapp_opened" | "pix_approved";

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
  status: PartnerPurchaseStatus;
  createdAt: string;
};

export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired" | "refunded";

export type PaymentRecord = {
  id: string;
  provider: "mercado_pago";
  providerPaymentId?: string;
  status: PaymentStatus;
  userId: string;
  userEmail: string;
  couponCode?: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  cashback: number;
  cashbackApplied: boolean;
  partnerPurchaseId?: string;
  items: PartnerPurchaseItem[];
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixTicketUrl?: string;
  createdAt: string;
  expiresAt?: string;
  updatedAt: string;
  approvedAt?: string;
};

export type InventoryReservationStatus = "active" | "expired" | "converted" | "released";

export type InventoryReservation = {
  id: string;
  paymentId: string;
  userId: string;
  userEmail: string;
  items: PartnerPurchaseItem[];
  status: InventoryReservationStatus;
  createdAt: string;
  expiresAt: string;
  convertedAt?: string;
  releasedAt?: string;
};

export type EcommerceSale = {
  id: string;
  paymentId: string;
  userId: string;
  userEmail: string;
  couponCode?: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  cashback: number;
  items: PartnerPurchaseItem[];
  createdAt: string;
  approvedAt: string;
};

export type RaffleEntry = {
  id: string;
  raffleId: string;
  userId: string;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CartReminder = {
  userId: string;
  userEmail: string;
  userName?: string;
  items: PartnerPurchaseItem[];
  subtotalCents: number;
  updatedAt: string;
  remindAfter: string;
  reminderSentAt?: string;
  clearedAt?: string;
};

export type Database = {
  users: User[];
  categories: Category[];
  products: Product[];
  partnerPurchases: PartnerPurchase[];
  payments: PaymentRecord[];
  inventoryReservations: InventoryReservation[];
  ecommerceSales: EcommerceSale[];
  raffleEntries: RaffleEntry[];
  cartReminders: CartReminder[];
};

export type RequestUser = {
  id: string;
  role: UserRole;
  email: string;
};
