import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PaymentRecord, PaymentStatus, PartnerPurchaseItem, User } from "../domain";
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
const partnerCommissionPercent = 5;

@Injectable()
export class PaymentsService {
  constructor(@Inject(JsonStoreService) private readonly store: JsonStoreService) {}

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
    const cleanedDuplicates = this.expireDuplicatePendingPayments(userPayments);
    const activePendingPayment = this.findActivePendingPaymentForItems(userPayments, items);

    if (activePendingPayment) {
      if (cleanedDuplicates) {
        await this.store.write(data);
      }

      return { ...this.toPublicPayment(activePendingPayment), reusedPending: true };
    }

    const discountCents = Math.max(0, subtotalCents - totalCents);
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const expiresAt = new Date(nowDate.getTime() + 30 * 60 * 1000).toISOString();
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
    payment.expiresAt = mpPayment.date_of_expiration ?? payment.expiresAt;
    payment.updatedAt = new Date().toISOString();
    data.payments.push(payment);
    await this.store.write(data);

    return this.toPublicPayment(payment);
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

    shouldWrite = this.expireDuplicatePendingPayments(userPayments);

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

  private async createMercadoPagoPix(accessToken: string, payment: PaymentRecord, user: User) {
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
        date_of_expiration: payment.expiresAt,
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
    const payment = data.payments.find((item) => item.providerPaymentId === providerPaymentId);

    if (!payment) {
      return;
    }

    payment.status = this.normalizeProviderStatus(providerPayment.status);
    payment.expiresAt = providerPayment.date_of_expiration ?? payment.expiresAt;
    if (payment.status === "pending" && this.isPaymentExpired(payment)) {
      payment.status = "expired";
    }
    payment.updatedAt = new Date().toISOString();
    payment.approvedAt = providerPayment.date_approved ?? payment.approvedAt;

    if (payment.status === "approved" && !payment.cashbackApplied) {
      this.applyApprovedPayment(data, payment);
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
    return Math.round(totalCents / 100) * 10;
  }

  private normalizeOptionalCoupon(value: unknown) {
    return typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  }

  private isPaymentExpired(payment: PaymentRecord) {
    return Boolean(payment.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now());
  }

  private findActivePendingPaymentForItems(payments: PaymentRecord[], items: PartnerPurchaseItem[]) {
    const requestedKeys = new Set(this.itemKeys(items));

    return payments
      .filter((payment) => payment.status === "pending" && !this.isPaymentExpired(payment))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
      .find((payment) => this.itemKeys(payment.items).some((key) => requestedKeys.has(key)));
  }

  private expireDuplicatePendingPayments(payments: PaymentRecord[]) {
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
        changed = true;
        continue;
      }

      keys.forEach((key) => activeItemKeys.add(key));
    }

    return changed;
  }

  private itemKeys(items: PartnerPurchaseItem[]) {
    return items.map((item) => (
      item.productId
        ? `product:${item.productId}`
        : `name:${item.name.trim().toLowerCase()}`
    ));
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
