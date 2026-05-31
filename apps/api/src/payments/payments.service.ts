import { BadRequestException, Inject, Injectable, OnModuleDestroy, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { EmailsService } from "../emails/emails.service";
import { Database, PaymentRecord, PaymentStatus, PartnerPurchaseItem, User } from "../domain";
import { JsonStoreService } from "../storage/json-store.service";

type MercadoPagoPaymentResponse = {
  id?: number;
  status?: string;
  status_detail?: string;
  date_approved?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  message?: string;
  error?: string;
};

const mercadoPagoApiUrl = "https://api.mercadopago.com/v1/payments";
const abandonedCartDelayMs = 3 * 60 * 60 * 1000;
const cartReminderSweepMs = 5 * 60 * 1000;
const cartReservationMs = 2 * 60 * 1000;
const pixPaymentExpirationMs = 5 * 60 * 1000;

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private cartReminderInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(JsonStoreService) private readonly store: JsonStoreService,
    @Inject(EmailsService) private readonly emails: EmailsService
  ) {}

  onModuleInit() {
    this.cartReminderInterval = setInterval(() => {
      void this.sendDueCartReminders();
    }, cartReminderSweepMs);
    void this.sendDueCartReminders();
  }

  onModuleDestroy() {
    if (this.cartReminderInterval) {
      clearInterval(this.cartReminderInterval);
    }
  }

  async createPixPayment(userId: string, input: Record<string, unknown>) {
    const accessToken = this.requireAccessToken();
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    if (user.banned) {
      throw new UnauthorizedException("Conta banida");
    }

    const items = this.normalizeItems(input.items);
    const subtotalCents = this.normalizeCents(input.subtotalCents);
    const totalCents = this.normalizeCents(input.totalCents);

    if (items.length === 0 || totalCents <= 0 || subtotalCents <= 0) {
      throw new BadRequestException("Pedido inválido");
    }

    const userPayments = data.payments.filter((payment) => payment.userId === user.id);
    let shouldWrite = this.releaseCartReservationForUser(data, user.id);
    shouldWrite = this.expireStaleReservations(data) || shouldWrite;
    shouldWrite = this.expireDuplicatePendingPayments(data, userPayments) || shouldWrite;
    const activePendingPayment = this.findActivePendingPaymentForItems(data, userPayments, items);

    if (activePendingPayment) {
      if (shouldWrite) {
        await this.store.write(data);
      }

      return { ...this.toPublicPayment(activePendingPayment), reusedPending: true };
    }

    this.ensureInventoryAvailable(data, items);

    const discountCents = Math.max(0, subtotalCents - totalCents);
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const expiresAt = new Date(nowDate.getTime() + pixPaymentExpirationMs).toISOString();
    const payment: PaymentRecord = {
      id: crypto.randomUUID(),
      provider: "mercado_pago",
      status: "pending",
      userId: user.id,
      userEmail: user.email,
      couponCode: this.normalizeOptionalCoupon(input.couponCode) || undefined,
      subtotalCents,
      discountCents,
      totalCents,
      cashback: this.cashbackFor(totalCents),
      cashbackApplied: false,
      items,
      createdAt: now,
      expiresAt,
      updatedAt: now
    };

    const mpPayment = await this.createMercadoPagoPix(accessToken, payment, user);
    payment.providerPaymentId = mpPayment.id ? String(mpPayment.id) : undefined;
    payment.status = this.normalizeProviderStatus(mpPayment.status);
    payment.pixQrCode = mpPayment.point_of_interaction?.transaction_data?.qr_code;
    payment.pixQrCodeBase64 = mpPayment.point_of_interaction?.transaction_data?.qr_code_base64;
    payment.pixTicketUrl = mpPayment.point_of_interaction?.transaction_data?.ticket_url;
    payment.updatedAt = new Date().toISOString();
    data.payments.push(payment);
    data.inventoryReservations.push({
      id: crypto.randomUUID(),
      paymentId: payment.id,
      userId: user.id,
      userEmail: user.email,
      items,
      status: "active",
      createdAt: now,
      expiresAt
    });
    await this.store.write(data);
    void this.emails.sendPurchaseCreatedEmail(payment);

    return this.toPublicPayment(payment);
  }

  async updateCartActivity(userId: string, input: Record<string, unknown>) {
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    if (user.banned) {
      throw new UnauthorizedException("Conta banida");
    }

    const items = this.normalizeItems(input.items);
    const now = new Date();
    const existing = data.cartReminders.find((reminder) => reminder.userId === user.id);

    if (items.length === 0) {
      if (existing) {
        existing.items = [];
        existing.subtotalCents = 0;
        existing.updatedAt = now.toISOString();
        existing.clearedAt = now.toISOString();
      }

      this.releaseCartReservationForUser(data, user.id);
      await this.store.write(data);
      return { tracked: false };
    }

    this.expireStaleReservations(data);
    this.ensureInventoryAvailable(data, items, this.cartReservationKey(user.id));

    const subtotalCents = items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
    const reminder = existing ?? {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      items: [],
      subtotalCents: 0,
      updatedAt: now.toISOString(),
      remindAfter: now.toISOString()
    };

    reminder.userEmail = user.email;
    reminder.userName = user.name;
    reminder.items = items;
    reminder.subtotalCents = subtotalCents;
    reminder.updatedAt = now.toISOString();
    reminder.remindAfter = new Date(now.getTime() + abandonedCartDelayMs).toISOString();
    reminder.reminderSentAt = undefined;
    reminder.clearedAt = undefined;

    if (!existing) {
      data.cartReminders.push(reminder);
    }

    this.upsertCartReservation(data, user, items, now);
    await this.store.write(data);
    return { tracked: true, remindAfter: reminder.remindAfter };
  }

  async getPayment(userId: string, paymentId: string) {
    const data = await this.store.read();
    const payment = data.payments.find((item) => item.id === paymentId);

    if (!payment || payment.userId !== userId) {
      throw new BadRequestException("Pagamento não encontrado");
    }

    if (payment.providerPaymentId && payment.status === "pending") {
      await this.syncMercadoPagoPayment(payment.providerPaymentId);
      const updatedData = await this.store.read();
      const updatedPayment = updatedData.payments.find((item) => item.id === paymentId) ?? payment;

      if (updatedPayment.status === "pending" && this.isPaymentExpired(updatedPayment)) {
        updatedPayment.status = "expired";
        updatedPayment.updatedAt = new Date().toISOString();
        this.releaseReservationsForPayment(updatedData, updatedPayment.id, "expired");
        await this.store.write(updatedData);
      }

      return this.toPublicPayment(updatedPayment);
    }

    return this.toPublicPayment(payment);
  }

  async listUserPayments(userId: string) {
    const data = await this.store.read();
    const userPayments = data.payments
      .filter((payment) => payment.userId === userId)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

    let shouldWrite = false;

    shouldWrite = this.expireStaleReservations(data);
    shouldWrite = this.expireDuplicatePendingPayments(data, userPayments) || shouldWrite;

    if (shouldWrite) {
      await this.store.write(data);
    }

    return userPayments.map((payment) => this.toPublicPayment(payment));
  }

  async handleMercadoPagoWebhook(paymentId: string | undefined, body: Record<string, unknown>) {
    const providerPaymentId = paymentId
      ?? (typeof body.id === "number" || typeof body.id === "string" ? String(body.id) : undefined)
      ?? (typeof body.data === "object" && body.data && "id" in body.data ? String((body.data as { id?: unknown }).id) : undefined);

    if (!providerPaymentId) {
      return { received: true };
    }

    await this.syncMercadoPagoPayment(providerPaymentId);
    return { received: true };
  }

  async getSalesReport(input: { startDate?: string; endDate?: string }) {
    const data = await this.store.read();
    const changed = this.expireStaleReservations(data);
    const startTime = input.startDate ? new Date(input.startDate).getTime() : Number.NEGATIVE_INFINITY;
    const endTime = input.endDate ? new Date(`${input.endDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    const sales = [...data.ecommerceSales]
      .filter((sale) => {
        const approvedTime = new Date(sale.approvedAt).getTime();
        return approvedTime >= startTime && approvedTime <= endTime;
      })
      .sort((first, second) => new Date(second.approvedAt).getTime() - new Date(first.approvedAt).getTime());
    const activeReservations = [...data.inventoryReservations]
      .filter((reservation) => reservation.status === "active" && new Date(reservation.expiresAt).getTime() > Date.now())
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
    const itemCount = sales.reduce((total, sale) => total + sale.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    const productBreakdown = Array.from(sales.reduce((acc, sale) => {
      for (const item of sale.items) {
        const key = item.productId ?? item.name;
        const current = acc.get(key) ?? {
          productId: item.productId,
          name: item.name,
          quantity: 0,
          totalCents: 0
        };
        current.quantity += item.quantity;
        current.totalCents += item.priceCents * item.quantity;
        acc.set(key, current);
      }

      return acc;
    }, new Map<string, { productId?: string; name: string; quantity: number; totalCents: number }>()).values())
      .sort((first, second) => second.totalCents - first.totalCents);

    if (changed) {
      await this.store.write(data);
    }

    return {
      summary: {
        saleCount: sales.length,
        itemCount,
        subtotalCents: sales.reduce((total, sale) => total + sale.subtotalCents, 0),
        discountCents: sales.reduce((total, sale) => total + sale.discountCents, 0),
        totalCents: sales.reduce((total, sale) => total + sale.totalCents, 0),
        cashback: sales.reduce((total, sale) => total + sale.cashback, 0),
        averageTicketCents: sales.length ? Math.round(sales.reduce((total, sale) => total + sale.totalCents, 0) / sales.length) : 0,
        activeReservationCount: activeReservations.length,
        reservedItemCount: activeReservations.reduce((total, reservation) => total + reservation.items.reduce((sum, item) => sum + item.quantity, 0), 0)
      },
      productBreakdown,
      sales,
      reservations: activeReservations
    };
  }

  private async createMercadoPagoPix(accessToken: string, payment: PaymentRecord, user: User) {
    const providerExpiresAt = new Date(new Date(payment.createdAt).getTime() + 30 * 60 * 1000).toISOString();
    const response = await fetch(mercadoPagoApiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "x-idempotency-key": payment.id
      },
      body: JSON.stringify({
        transaction_amount: payment.totalCents / 100,
        description: `Hellcife Geek - pedido ${payment.id}`,
        payment_method_id: "pix",
        date_of_expiration: providerExpiresAt,
        external_reference: payment.id,
        notification_url: process.env.MERCADO_PAGO_WEBHOOK_URL,
        payer: {
          email: user.email,
          first_name: user.name
        },
        additional_info: {
          items: payment.items.map((item) => ({
            id: item.productId,
            title: item.name,
            quantity: item.quantity,
            unit_price: item.priceCents / 100
          }))
        }
      })
    });
    const payload = (await response.json()) as MercadoPagoPaymentResponse;

    if (!response.ok) {
      throw new BadRequestException(payload.message ?? payload.error ?? "Não foi possível gerar o Pix");
    }

    return payload;
  }

  private async syncMercadoPagoPayment(providerPaymentId: string) {
    const accessToken = this.requireAccessToken();
    const response = await fetch(`${mercadoPagoApiUrl}/${encodeURIComponent(providerPaymentId)}`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      return;
    }

    const providerPayment = (await response.json()) as MercadoPagoPaymentResponse;
    const data = await this.store.read();
    this.expireStaleReservations(data);
    const payment = data.payments.find((item) => item.providerPaymentId === providerPaymentId);

    if (!payment) {
      return;
    }

    const providerStatus = this.normalizeProviderStatus(providerPayment.status);
    const providerApprovedAt = providerPayment.date_approved ?? payment.approvedAt;

    if (providerStatus === "approved" && this.wasApprovedBeforeInternalExpiration(payment, providerApprovedAt)) {
      payment.status = "approved";
      payment.approvedAt = providerApprovedAt;
    } else if (this.isPaymentExpired(payment)) {
      payment.status = "expired";
    } else {
      payment.status = providerStatus;
      payment.approvedAt = providerApprovedAt;
    }
    payment.updatedAt = new Date().toISOString();

    const shouldSendApprovedEmail = payment.status === "approved" && !payment.cashbackApplied;

    if (shouldSendApprovedEmail) {
      this.applyApprovedPayment(data, payment);
    } else if (payment.status !== "pending" && payment.status !== "approved") {
      this.releaseReservationsForPayment(data, payment.id, "released");
    }

    await this.store.write(data);

    if (shouldSendApprovedEmail) {
      void this.emails.sendPaymentApprovedAdminEmail(payment);
    }
  }

  private async sendDueCartReminders() {
    const data = await this.store.read();
    const now = Date.now();
    const dueReminders = data.cartReminders.filter((reminder) => (
      !reminder.reminderSentAt
      && !reminder.clearedAt
      && reminder.items.length > 0
      && new Date(reminder.remindAfter).getTime() <= now
    ));

    if (dueReminders.length === 0) {
      return;
    }

    for (const reminder of dueReminders) {
      await this.emails.sendAbandonedCartReminder({
        userEmail: reminder.userEmail,
        userName: reminder.userName,
        subtotalCents: reminder.subtotalCents,
        items: reminder.items
      });
      reminder.reminderSentAt = new Date().toISOString();
    }

    await this.store.write(data);
  }

  private applyApprovedPayment(data: Awaited<ReturnType<JsonStoreService["read"]>>, payment: PaymentRecord) {
    const user = data.users.find((item) => item.id === payment.userId);

    if (user) {
      user.hellpoints = Math.max(0, Math.floor(Number(user.hellpoints ?? 0))) + payment.cashback;
      user.raffleTickets = Math.max(0, Math.floor(Number(user.raffleTickets ?? 0)));
    }

    const partner = payment.couponCode ? data.users.find((item) => (
      item.role === "partner"
      && !item.banned
      && item.partnerCouponCode?.toUpperCase() === payment.couponCode
    )) : undefined;

    if (partner && payment.couponCode && !payment.partnerPurchaseId) {
      const partnerPurchaseId = crypto.randomUUID();
      data.partnerPurchases.push({
        id: partnerPurchaseId,
        partnerId: partner.id,
        customerId: payment.userId,
        customerName: user?.name,
        customerEmail: payment.userEmail,
        couponCode: payment.couponCode,
        subtotalCents: payment.subtotalCents,
        discountCents: payment.discountCents,
        totalCents: payment.totalCents,
        items: payment.items,
        status: "pix_approved",
        createdAt: payment.approvedAt ?? new Date().toISOString()
      });
      payment.partnerPurchaseId = partnerPurchaseId;
    }

    this.convertReservationsForPayment(data, payment.id);
    this.subtractSoldStock(data, payment.items);
    this.recordEcommerceSale(data, payment);
    payment.cashbackApplied = true;
  }

  private toPublicPayment(payment: PaymentRecord) {
    return {
      id: payment.id,
      status: payment.status,
      totalCents: payment.totalCents,
      cashback: payment.cashback,
      items: payment.items,
      pixQrCode: payment.pixQrCode,
      pixQrCodeBase64: payment.pixQrCodeBase64,
      pixTicketUrl: payment.pixTicketUrl,
      createdAt: payment.createdAt,
      approvedAt: payment.approvedAt,
      expiresAt: payment.expiresAt
    };
  }

  private normalizeItems(value: unknown): PartnerPurchaseItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.slice(0, 50).map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        productId: typeof entry.productId === "string" ? entry.productId : undefined,
        variationId: typeof entry.variationId === "string" ? entry.variationId : undefined,
        variationName: typeof entry.variationName === "string" && entry.variationName.trim() ? entry.variationName.trim() : undefined,
        name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "Produto",
        quantity: Math.max(1, Math.floor(Number(entry.quantity ?? 1))),
        priceCents: Math.max(0, Math.floor(Number(entry.priceCents ?? 0)))
      };
    });
  }

  private normalizeCents(value: unknown) {
    const cents = Number(value);
    return Number.isFinite(cents) && cents > 0 ? Math.floor(cents) : 0;
  }

  private cashbackFor(totalCents: number) {
    return Math.max(0, Math.floor(totalCents / 10));
  }

  private normalizeOptionalCoupon(value: unknown) {
    return typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  }

  private isPaymentExpired(payment: PaymentRecord) {
    return Boolean(payment.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now());
  }

  private wasApprovedBeforeInternalExpiration(payment: PaymentRecord, approvedAt: string | undefined) {
    if (!payment.expiresAt) {
      return true;
    }

    if (!approvedAt) {
      return !this.isPaymentExpired(payment);
    }

    return new Date(approvedAt).getTime() <= new Date(payment.expiresAt).getTime();
  }

  private findActivePendingPaymentForItems(data: Database, payments: PaymentRecord[], items: PartnerPurchaseItem[]) {
    const requestedKeys = new Set(this.itemKeys(items));

    return payments
      .filter((payment) => payment.status === "pending" && !this.isPaymentExpired(payment) && this.hasActiveReservation(data, payment.id))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
      .find((payment) => this.itemKeys(payment.items).some((key) => requestedKeys.has(key)));
  }

  private expireDuplicatePendingPayments(data: Database, payments: PaymentRecord[]) {
    const activeItemKeys = new Set<string>();
    let changed = false;
    const pendingPayments = [...payments]
      .filter((payment) => payment.status === "pending")
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

    for (const payment of pendingPayments) {
      const keys = this.itemKeys(payment.items);
      const isDuplicate = keys.some((key) => activeItemKeys.has(key));

      if (this.isPaymentExpired(payment) || isDuplicate) {
        payment.status = "expired";
        payment.updatedAt = new Date().toISOString();
        this.releaseReservationsForPayment(data, payment.id, "expired");
        changed = true;
        continue;
      }

      keys.forEach((key) => activeItemKeys.add(key));
    }

    return changed;
  }

  private ensureInventoryAvailable(data: Database, items: PartnerPurchaseItem[], excludedReservationId?: string) {
    const reservedByItem = this.reservedQuantitiesByItem(data, excludedReservationId);

    for (const item of items) {
      if (!item.productId) {
        continue;
      }

      const product = data.products.find((entry) => entry.id === item.productId);

      if (!product || !product.active) {
        throw new BadRequestException(`${item.name} não está disponível para venda`);
      }

      const variation = item.variationId
        ? product.variations?.find((entry) => entry.id === item.variationId)
        : undefined;

      if (item.variationId && !variation) {
        throw new BadRequestException(`${item.name} não está disponível para venda`);
      }

      const baseStock = variation?.stock === undefined ? product.stock : variation.stock;
      const available = Math.max(0, Math.floor(Number(baseStock ?? 0)) - (reservedByItem.get(this.inventoryStockKey(item, variation)) ?? 0));

      if (item.quantity > available) {
        throw new BadRequestException(`${item.name} está indisponível no momento`);
      }
    }
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

  private hasActiveReservation(data: Database, paymentId: string) {
    const now = Date.now();
    return (data.inventoryReservations ?? []).some((reservation) => (
      reservation.paymentId === paymentId
      && reservation.status === "active"
      && new Date(reservation.expiresAt).getTime() > now
    ));
  }

  private reservedQuantitiesByItem(data: Database, excludedReservationId?: string) {
    const reservedByItem = new Map<string, number>();
    const now = Date.now();

    for (const reservation of data.inventoryReservations ?? []) {
      if (excludedReservationId && reservation.id === excludedReservationId) {
        continue;
      }

      if (reservation.status !== "active" || new Date(reservation.expiresAt).getTime() <= now) {
        continue;
      }

      for (const item of reservation.items) {
        if (!item.productId) {
          continue;
        }

        const product = data.products.find((entry) => entry.id === item.productId);
        const variation = item.variationId
          ? product?.variations?.find((entry) => entry.id === item.variationId)
          : undefined;
        const key = this.inventoryStockKey(item, variation);
        reservedByItem.set(key, (reservedByItem.get(key) ?? 0) + item.quantity);
      }
    }

    return reservedByItem;
  }

  private cartReservationKey(userId: string) {
    return `cart:${userId}`;
  }

  private upsertCartReservation(data: Database, user: User, items: PartnerPurchaseItem[], now: Date) {
    const reservationId = this.cartReservationKey(user.id);
    const existing = data.inventoryReservations.find((reservation) => reservation.id === reservationId);
    const reservation = existing ?? {
      id: reservationId,
      paymentId: reservationId,
      userId: user.id,
      userEmail: user.email,
      items: [],
      status: "active" as const,
      createdAt: now.toISOString(),
      expiresAt: now.toISOString()
    };

    reservation.userEmail = user.email;
    reservation.items = items;
    reservation.status = "active";
    reservation.expiresAt = new Date(now.getTime() + cartReservationMs).toISOString();
    reservation.releasedAt = undefined;
    reservation.convertedAt = undefined;

    if (!existing) {
      data.inventoryReservations.push(reservation);
    }
  }

  private releaseCartReservationForUser(data: Database, userId: string) {
    const reservationId = this.cartReservationKey(userId);
    let changed = false;

    for (const reservation of data.inventoryReservations ?? []) {
      if (reservation.id === reservationId && reservation.status === "active") {
        reservation.status = "released";
        reservation.releasedAt = new Date().toISOString();
        changed = true;
      }
    }

    return changed;
  }

  private releaseReservationsForPayment(data: Database, paymentId: string, status: "expired" | "released") {
    const now = new Date().toISOString();

    for (const reservation of data.inventoryReservations ?? []) {
      if (reservation.paymentId === paymentId && reservation.status === "active") {
        reservation.status = status;
        reservation.releasedAt = now;
      }
    }
  }

  private convertReservationsForPayment(data: Database, paymentId: string) {
    const now = new Date().toISOString();

    for (const reservation of data.inventoryReservations ?? []) {
      if (reservation.paymentId === paymentId && reservation.status !== "converted") {
        reservation.status = "converted";
        reservation.convertedAt = now;
      }
    }
  }

  private subtractSoldStock(data: Database, items: PartnerPurchaseItem[]) {
    for (const item of items) {
      if (!item.productId) {
        continue;
      }

      const product = data.products.find((entry) => entry.id === item.productId);

      if (product) {
        const variation = item.variationId
          ? product.variations?.find((entry) => entry.id === item.variationId)
          : undefined;

        if (variation && variation.stock !== undefined) {
          variation.stock = Math.max(0, Math.floor(Number(variation.stock ?? 0)) - item.quantity);
        } else {
          product.stock = Math.max(0, Math.floor(Number(product.stock ?? 0)) - item.quantity);
        }

        product.updatedAt = new Date().toISOString();
      }
    }
  }

  private recordEcommerceSale(data: Database, payment: PaymentRecord) {
    if (data.ecommerceSales.some((sale) => sale.paymentId === payment.id)) {
      return;
    }

    data.ecommerceSales.push({
      id: crypto.randomUUID(),
      paymentId: payment.id,
      userId: payment.userId,
      userEmail: payment.userEmail,
      couponCode: payment.couponCode,
      subtotalCents: payment.subtotalCents,
      discountCents: payment.discountCents,
      totalCents: payment.totalCents,
      cashback: payment.cashback,
      items: payment.items,
      createdAt: payment.createdAt,
      approvedAt: payment.approvedAt ?? new Date().toISOString()
    });
  }

  private itemKeys(items: PartnerPurchaseItem[]) {
    return items.map((item) => this.inventoryItemKey(item));
  }

  private inventoryItemKey(item: PartnerPurchaseItem) {
    if (item.productId && item.variationId) {
      return `product:${item.productId}:variation:${item.variationId}`;
    }

    if (item.productId) {
      return `product:${item.productId}`;
    }

    return `name:${item.name.trim().toLowerCase()}`;
  }

  private inventoryStockKey(item: PartnerPurchaseItem, variation?: { id: string; stock?: number }) {
    if (item.productId && variation?.stock !== undefined) {
      return `product:${item.productId}:variation:${variation.id}`;
    }

    return this.inventoryItemKey({ ...item, variationId: undefined });
  }

  private normalizeProviderStatus(status: unknown): PaymentStatus {
    if (status === "approved") {
      return "approved";
    }

    if (status === "rejected") {
      return "rejected";
    }

    if (status === "cancelled") {
      return "cancelled";
    }

    if (status === "refunded") {
      return "refunded";
    }

    return "pending";
  }

  private requireAccessToken() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new BadRequestException("Mercado Pago não configurado");
    }

    return accessToken;
  }
}
