import { BadRequestException, ConflictException, Inject, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Database, PartnerPurchaseItem, PublicUser, RequestUser, User, UserRole } from "../domain";
import { JsonStoreService } from "../storage/json-store.service";

const scrypt = promisify(scryptCallback);

type RegisterInput = {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  termsAccepted?: boolean;
  marketingEmailsOptIn?: boolean;
};

type LoginInput = {
  email?: string;
  password?: string;
};

const signupHellpointsBonus = 50;
const raffleTicketCost = 50;
const partnerDiscountPercent = 10;
const partnerCommissionPercent = 5;
const launchRaffleId = "launch-8bitdo-controller";
const launchRaffleGoal = 125;
const launchRaffleTitle = "Sorteio de lançamento";
const launchRafflePrize = "Controle 8BitDo original";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly tokenSecret = process.env.AUTH_SECRET ?? "dev-secret-change-me";
  private readonly googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
  private readonly googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  private readonly defaultGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback/google";

  constructor(@Inject(JsonStoreService) private readonly store: JsonStoreService) {}

  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  async registerClient(input: RegisterInput) {
    const email = this.normalizeEmail(input.email);
    const password = this.requirePassword(input.password);
    const name = this.requireText(input.name, "name");

    if (input.termsAccepted !== true) {
      throw new BadRequestException("Aceite dos termos obrigatório");
    }

    const data = await this.store.read();
    const acceptedAt = new Date().toISOString();

    if (data.users.some((user) => user.email === email)) {
      throw new ConflictException("Email ja cadastrado");
    }

    const user: User = {
      id: crypto.randomUUID(),
      name,
      email,
      phone: input.phone?.trim() || undefined,
      passwordHash: await this.hashPassword(password),
      role: "client",
      hellpoints: signupHellpointsBonus,
      raffleTickets: 0,
      banned: false,
      termsAcceptedAt: acceptedAt,
      privacyAcceptedAt: acceptedAt,
      marketingEmailsOptIn: Boolean(input.marketingEmailsOptIn),
      createdAt: new Date().toISOString()
    };

    data.users.push(user);
    await this.store.write(data);

    return this.sessionFor(user);
  }

  async login(input: LoginInput, expectedRole?: UserRole) {
    const email = this.normalizeEmail(input.email);
    const password = this.requirePassword(input.password);
    const data = await this.store.read();
    const user = data.users.find((item) => item.email === email);

    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    if (expectedRole && user.role !== expectedRole) {
      throw new UnauthorizedException("Acesso nao permitido para este perfil");
    }

    this.ensureUserCanAccess(user);
    return this.sessionFor(user);
  }

  async listUsers() {
    const data = await this.store.read();
    return data.users.map((user) => this.toPublicUser(user));
  }

  googleAuthUrl(redirectUri = this.defaultGoogleRedirectUri, state?: string) {
    this.requireGoogleConfig();

    const params = new URLSearchParams({
      client_id: this.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account"
    });

    if (state) {
      params.set("state", state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async loginWithGoogleCode(input: Record<string, unknown>) {
    this.requireGoogleConfig();

    if (typeof input.code !== "string" || !input.code.trim()) {
      throw new UnauthorizedException("Codigo Google invalido");
    }

    const redirectUri = typeof input.redirectUri === "string" && input.redirectUri.trim()
      ? input.redirectUri.trim()
      : this.defaultGoogleRedirectUri;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new UnauthorizedException(tokenData.error_description ?? tokenData.error ?? "Falha ao autenticar com Google");
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

    if (!userInfoResponse.ok || !userInfo.email || userInfo.email_verified === false) {
      throw new UnauthorizedException("Conta Google sem email verificado");
    }

    const email = this.normalizeEmail(userInfo.email);
    const data = await this.store.read();
    let user = data.users.find((item) => item.email === email);
    const mode = typeof input.mode === "string" ? input.mode : "login";

    if (!user) {
      if (mode !== "signup") {
        throw new UnauthorizedException("google_account_not_found");
      }

      if (input.termsAccepted !== true) {
        throw new BadRequestException("google_terms_required");
      }

      const now = new Date().toISOString();
      user = {
        id: crypto.randomUUID(),
        name: userInfo.name?.trim() || email.split("@")[0],
        email,
        phone: undefined,
        passwordHash: await this.hashPassword(randomBytes(32).toString("base64url")),
        role: "client",
        hellpoints: signupHellpointsBonus,
        raffleTickets: 0,
        banned: false,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        marketingEmailsOptIn: input.marketingEmailsOptIn === true,
        createdAt: now
      };
      data.users.push(user);
      await this.store.write(data);
    }

    this.ensureUserCanAccess(user);
    return this.sessionFor(user);
  }

  verifyToken(token: string): RequestUser {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new UnauthorizedException("Token invalido");
    }

    const expectedSignature = this.sign(encodedPayload);

    if (!this.safeCompare(signature, expectedSignature)) {
      throw new UnauthorizedException("Token invalido");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as RequestUser & { exp: number };

    if (payload.exp < Date.now()) {
      throw new UnauthorizedException("Token expirado");
    }

    return {
      id: payload.id,
      email: payload.email,
      role: payload.role
    };
  }

  toPublicUser(user: User): PublicUser {
    user.hellpoints = this.normalizePoints(user.hellpoints);
    user.raffleTickets = this.normalizePoints(user.raffleTickets);
    user.banned = Boolean(user.banned);
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }

  async getProfile(userId: string) {
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    this.ensureUserCanAccess(user);
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, input: Record<string, unknown>) {
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }

    this.ensureUserCanAccess(user);

    if (typeof input.phone === "string") {
      user.phone = input.phone.trim() || undefined;
    }

    await this.store.write(data);

    return this.toPublicUser(user);
  }

  async buyRaffleTicket(userId: string) {
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuario nao encontrado");
    }

    this.ensureUserCanAccess(user);
    user.hellpoints = this.normalizePoints(user.hellpoints);
    user.raffleTickets = this.normalizePoints(user.raffleTickets);

    if (user.hellpoints < raffleTicketCost) {
      throw new BadRequestException("Hellpoints insuficientes");
    }

    user.hellpoints -= raffleTicketCost;
    user.raffleTickets += 1;
    await this.store.write(data);

    return this.toPublicUser(user);
  }

  async getLaunchRaffle(userId: string) {
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuario nao encontrado");
    }

    this.ensureUserCanAccess(user);
    return this.buildLaunchRaffleSummary(data, user.id);
  }

  async enterLaunchRaffle(userId: string) {
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuario nao encontrado");
    }

    this.ensureUserCanAccess(user);
    user.raffleTickets = this.normalizePoints(user.raffleTickets);

    if (user.raffleTickets < 1) {
      throw new BadRequestException("Você precisa ter pelo menos 1 ticket");
    }

    const now = new Date().toISOString();
    const entry = data.raffleEntries.find((item) => item.raffleId === launchRaffleId && item.userId === user.id);
    user.raffleTickets -= 1;

    if (entry) {
      entry.ticketCount = this.normalizePoints(entry.ticketCount) + 1;
      entry.updatedAt = now;
    } else {
      data.raffleEntries.push({
        id: crypto.randomUUID(),
        raffleId: launchRaffleId,
        userId: user.id,
        ticketCount: 1,
        createdAt: now,
        updatedAt: now
      });
    }

    await this.store.write(data);

    return {
      user: this.toPublicUser(user),
      raffle: this.buildLaunchRaffleSummary(data, user.id)
    };
  }

  async getAdminLaunchRaffle() {
    const data = await this.store.read();
    const summary = this.buildLaunchRaffleSummary(data);
    const participants = data.raffleEntries
      .filter((entry) => entry.raffleId === launchRaffleId)
      .map((entry) => {
        const user = data.users.find((item) => item.id === entry.userId);

        return {
          userId: entry.userId,
          name: user?.name ?? "Usuário removido",
          email: user?.email ?? "sem-email",
          ticketCount: this.normalizePoints(entry.ticketCount),
          updatedAt: entry.updatedAt
        };
      })
      .sort((left, right) => right.ticketCount - left.ticketCount || left.email.localeCompare(right.email));

    return {
      ...summary,
      participants
    };
  }

  async addCashback(userId: string, input: Record<string, unknown>) {
    const totalCents = Number(input.totalCents);

    if (!Number.isFinite(totalCents) || totalCents <= 0) {
      throw new BadRequestException("Total invalido");
    }

    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuario nao encontrado");
    }

    this.ensureUserCanAccess(user);
    const cashback = Math.max(0, Math.floor(totalCents / 10));
    user.hellpoints = this.normalizePoints(user.hellpoints) + cashback;
    user.raffleTickets = this.normalizePoints(user.raffleTickets);
    const couponCode = this.normalizeOptionalCoupon(input.couponCode);
    const partner = couponCode ? data.users.find((item) => (
      item.role === "partner"
      && !item.banned
      && item.partnerCouponCode?.toUpperCase() === couponCode
    )) : undefined;

    if (partner) {
      const subtotalCents = this.normalizeCents(input.subtotalCents) || Math.round(totalCents / (1 - partnerDiscountPercent / 100));
      const discountCents = Math.max(0, subtotalCents - Math.floor(totalCents));
      data.partnerPurchases.push({
        id: crypto.randomUUID(),
        partnerId: partner.id,
        customerId: user.id,
        customerName: user.name,
        customerEmail: user.email,
        couponCode,
        subtotalCents,
        discountCents,
        totalCents: Math.floor(totalCents),
        items: this.normalizePurchaseItems(input.items),
        status: "whatsapp_opened",
        createdAt: new Date().toISOString()
      });
    }

    await this.store.write(data);

    return {
      user: this.toPublicUser(user),
      cashback,
      partnerPurchaseRegistered: Boolean(partner)
    };
  }

  async validateCoupon(code: string) {
    const couponCode = this.normalizeOptionalCoupon(code);

    if (!couponCode) {
      throw new BadRequestException("Cupom invalido");
    }

    const data = await this.store.read();
    const partner = data.users.find((user) => (
      user.role === "partner"
      && !user.banned
      && user.partnerCouponCode?.toUpperCase() === couponCode
    ));

    if (!partner) {
      throw new BadRequestException("Cupom invalido");
    }

    return {
      code: partner.partnerCouponCode,
      discountPercent: partner.partnerDiscountPercent || partnerDiscountPercent,
      partnerName: partner.name
    };
  }

  private buildLaunchRaffleSummary(data: Database, userId?: string) {
    const registeredCount = data.users.filter((user) => user.role !== "admin").length;
    const entries = data.raffleEntries.filter((entry) => entry.raffleId === launchRaffleId);
    const totalTickets = entries.reduce((total, entry) => total + this.normalizePoints(entry.ticketCount), 0);
    const userTickets = userId
      ? entries
        .filter((entry) => entry.userId === userId)
        .reduce((total, entry) => total + this.normalizePoints(entry.ticketCount), 0)
      : 0;

    return {
      id: launchRaffleId,
      title: launchRaffleTitle,
      prize: launchRafflePrize,
      goal: launchRaffleGoal,
      registeredCount,
      totalTickets,
      userTickets,
      unlocked: registeredCount >= launchRaffleGoal
    };
  }

  private async ensureDefaultAdmin() {
    const data = await this.store.read();

    if (data.users.some((user) => user.role === "admin")) {
      return;
    }

    data.users.push({
      id: crypto.randomUUID(),
      name: process.env.ADMIN_NAME ?? "Hellcife Admin",
      email: this.normalizeEmail(process.env.ADMIN_EMAIL ?? "admin@hellcifegeek.com.br"),
      phone: undefined,
      passwordHash: await this.hashPassword(this.requireAdminPassword()),
      role: "admin",
      hellpoints: 0,
      raffleTickets: 0,
      banned: false,
      createdAt: new Date().toISOString()
    });

    await this.store.write(data);
  }

  private sessionFor(user: User) {
    return {
      token: this.createToken(user),
      user: this.toPublicUser(user)
    };
  }

  private requireAdminPassword() {
    const password = process.env.ADMIN_PASSWORD;

    if (typeof password === "string" && password.length >= 16) {
      return password;
    }

    return randomBytes(32).toString("base64url");
  }

  private createToken(user: User) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  private sign(value: string) {
    return createHmac("sha256", this.tokenSecret).update(value).digest("base64url");
  }

  private normalizePoints(value: unknown) {
    return Math.max(0, Math.floor(Number(value ?? 0)));
  }

  private normalizeCents(value: unknown) {
    const cents = Number(value);
    return Number.isFinite(cents) && cents > 0 ? Math.floor(cents) : 0;
  }

  private normalizeOptionalCoupon(value: unknown) {
    return typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  }

  private normalizePurchaseItems(value: unknown): PartnerPurchaseItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.slice(0, 30).map((item) => {
      const entry = item as Record<string, unknown>;
      const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "Produto";

      return {
        productId: typeof entry.productId === "string" ? entry.productId : undefined,
        name,
        quantity: Math.max(1, Math.floor(Number(entry.quantity ?? 1))),
        priceCents: Math.max(0, Math.floor(Number(entry.priceCents ?? 0)))
      };
    });
  }

  private generatePartnerCoupon(user: User, users: User[]) {
    const base = (user.name || user.email.split("@")[0] || "PARCEIRO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 10) || "PARCEIRO";
    const existingCodes = new Set(users.map((item) => item.partnerCouponCode?.toUpperCase()).filter(Boolean));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(2).toString("hex").toUpperCase();
      const coupon = `${base}${suffix}`;

      if (!existingCodes.has(coupon)) {
        return coupon;
      }
    }

    return `PARCEIRO${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  async setUserBanned(adminId: string, userId: string, input: Record<string, unknown>) {
    const data = await this.store.read();
    const targetUser = data.users.find((user) => user.id === userId);

    if (!targetUser) {
      throw new BadRequestException("Usuario nao encontrado");
    }

    if (targetUser.id === adminId || targetUser.role === "admin") {
      throw new BadRequestException("Nao e permitido banir conta admin");
    }

    targetUser.banned = Boolean(input.banned);
    await this.store.write(data);

    return this.toPublicUser(targetUser);
  }

  async setUserPartner(adminId: string, userId: string, input: Record<string, unknown>) {
    const data = await this.store.read();
    const targetUser = data.users.find((user) => user.id === userId);

    if (!targetUser) {
      throw new BadRequestException("Usuario nao encontrado");
    }

    if (targetUser.id === adminId || targetUser.role === "admin") {
      throw new BadRequestException("Nao e permitido alterar perfil admin");
    }

    if (!Boolean(input.partner)) {
      targetUser.role = "client";
      targetUser.partnerCouponCode = undefined;
      targetUser.partnerDiscountPercent = undefined;
      targetUser.partnerSince = undefined;
      await this.store.write(data);
      return this.toPublicUser(targetUser);
    }

    targetUser.role = "partner";
    const requestedCouponCode = this.normalizeOptionalCoupon(input.couponCode);

    if (requestedCouponCode) {
      if (requestedCouponCode.length < 3) {
        throw new BadRequestException("Cupom deve ter pelo menos 3 caracteres");
      }

      const couponOwner = data.users.find((user) => (
        user.id !== targetUser.id
        && user.partnerCouponCode?.toUpperCase() === requestedCouponCode
      ));

      if (couponOwner) {
        throw new BadRequestException("Cupom ja esta em uso");
      }
    }

    targetUser.partnerCouponCode = requestedCouponCode || targetUser.partnerCouponCode || this.generatePartnerCoupon(targetUser, data.users);
    targetUser.partnerDiscountPercent = partnerDiscountPercent;
    targetUser.partnerSince = targetUser.partnerSince || new Date().toISOString();
    await this.store.write(data);

    return this.toPublicUser(targetUser);
  }

  async getPartnerDashboard(userId: string, filters: { startDate?: string; endDate?: string } = {}) {
    const data = await this.store.read();
    const partner = data.users.find((user) => user.id === userId);

    if (!partner) {
      throw new UnauthorizedException("Usuario nao encontrado");
    }

    this.ensureUserCanAccess(partner);

    if (partner.role !== "partner" && partner.role !== "admin") {
      throw new UnauthorizedException("Acesso permitido apenas para parceiros");
    }

    const startDate = this.parseDashboardDate(filters.startDate, false);
    const endDate = this.parseDashboardDate(filters.endDate, true);

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException("Data inicial maior que data final");
    }

    const purchases = data.partnerPurchases
      .filter((purchase) => {
        const purchaseDate = new Date(purchase.createdAt);

        return (partner.role === "admin" || purchase.partnerId === partner.id)
          && (!startDate || purchaseDate >= startDate)
          && (!endDate || purchaseDate <= endDate);
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const totalCents = purchases.reduce((total, purchase) => total + purchase.totalCents, 0);
    const discountCents = purchases.reduce((total, purchase) => total + purchase.discountCents, 0);
    const productsById = new Map(data.products.map((product) => [product.id, product]));
    const categoriesById = new Map(data.categories.map((category) => [category.id, category]));
    const categoryMap = new Map<string, { categoryId?: string; categoryName: string; quantity: number; totalCents: number }>();
    let itemCount = 0;

    for (const purchase of purchases) {
      for (const item of purchase.items) {
        const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
        const product = item.productId ? productsById.get(item.productId) : undefined;
        const category = product ? categoriesById.get(product.categoryId) : undefined;
        const categoryId = category?.id ?? "uncategorized";
        const current = categoryMap.get(categoryId) ?? {
          categoryId: category?.id,
          categoryName: category?.name ?? "Sem categoria",
          quantity: 0,
          totalCents: 0
        };

        current.quantity += quantity;
        current.totalCents += Math.max(0, Math.floor(Number(item.priceCents ?? 0))) * quantity;
        itemCount += quantity;
        categoryMap.set(categoryId, current);
      }
    }

    const categoryBreakdown = Array.from(categoryMap.values())
      .sort((left, right) => right.quantity - left.quantity || right.totalCents - left.totalCents);

    return {
      partner: this.toPublicUser(partner),
      purchases,
      summary: {
        purchaseCount: purchases.length,
        itemCount,
        totalCents,
        discountCents,
        commissionRate: partnerCommissionPercent,
        commissionCents: Math.round(totalCents * (partnerCommissionPercent / 100)),
        categoryBreakdown
      }
    };
  }

  private parseDashboardDate(value: unknown, endOfDay: boolean) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    const trimmed = value.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-03:00`)
      : new Date(trimmed);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Filtro de data invalido");
    }

    return date;
  }

  async deleteUser(adminId: string, userId: string) {
    const data = await this.store.read();
    const targetUser = data.users.find((user) => user.id === userId);

    if (!targetUser) {
      throw new BadRequestException("Usuario nao encontrado");
    }

    if (targetUser.id === adminId || targetUser.role === "admin") {
      throw new BadRequestException("Nao e permitido deletar conta admin");
    }

    data.users = data.users.filter((user) => user.id !== userId);
    await this.store.write(data);

    return { removed: true };
  }

  private ensureUserCanAccess(user: User) {
    if (user.banned) {
      throw new UnauthorizedException("Conta banida");
    }
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString("base64url");
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}.${derived.toString("base64url")}`;
  }

  private async verifyPassword(password: string, passwordHash: string) {
    const [salt, storedHash] = passwordHash.split(".");
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return this.safeCompare(derived.toString("base64url"), storedHash);
  }

  private safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private normalizeEmail(email: unknown) {
    if (typeof email !== "string" || !email.includes("@")) {
      throw new UnauthorizedException("Email invalido");
    }

    return email.trim().toLowerCase();
  }

  private requirePassword(password: unknown) {
    if (typeof password !== "string" || password.length < 8) {
      throw new UnauthorizedException("Senha deve ter pelo menos 8 caracteres");
    }

    return password;
  }

  private requireGoogleConfig() {
    if (!this.googleClientId || !this.googleClientSecret) {
      throw new UnauthorizedException("Google OAuth nao configurado");
    }
  }

  private requireText(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new UnauthorizedException(`${field} obrigatorio`);
    }

    return value.trim();
  }
}
