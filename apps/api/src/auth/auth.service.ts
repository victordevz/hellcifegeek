import { BadRequestException, ConflictException, Inject, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PublicUser, RequestUser, User, UserRole } from "../domain";
import { JsonStoreService } from "../storage/json-store.service";

const scrypt = promisify(scryptCallback);

type RegisterInput = {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
};

type LoginInput = {
  email?: string;
  password?: string;
};

const signupHellpointsBonus = 50;
const raffleTicketCost = 50;

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
    const data = await this.store.read();

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

    if (!user) {
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
        createdAt: new Date().toISOString()
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
      throw new UnauthorizedException("Usuario nao encontrado");
    }

    this.ensureUserCanAccess(user);
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, input: Record<string, unknown>) {
    const data = await this.store.read();
    const user = data.users.find((item) => item.id === userId);

    if (!user) {
      throw new UnauthorizedException("Usuario nao encontrado");
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
    const roundedReais = Math.round(totalCents / 100);
    const cashback = roundedReais * 10;
    user.hellpoints = this.normalizePoints(user.hellpoints) + cashback;
    user.raffleTickets = this.normalizePoints(user.raffleTickets);
    await this.store.write(data);

    return {
      user: this.toPublicUser(user),
      cashback
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
      passwordHash: await this.hashPassword(process.env.ADMIN_PASSWORD ?? "admin123"),
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
