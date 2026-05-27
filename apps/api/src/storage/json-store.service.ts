import { Injectable, OnModuleInit } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Database } from "../domain";
import { seedDatabase } from "./seed-database";

const emptyDatabase = (): Database => ({
  users: [],
  categories: [],
  products: [],
  partnerPurchases: [],
  payments: []
});

type SupabaseStateRow = {
  id: string;
  data: Database;
};

@Injectable()
export class JsonStoreService implements OnModuleInit {
  private readonly filePath = process.env.API_DB_PATH ?? join(process.cwd(), "data", "db.json");
  private readonly driver = process.env.API_STORE_DRIVER ?? "json";
  private readonly supabaseTable = process.env.SUPABASE_STATE_TABLE ?? "app_state";
  private readonly supabaseStateId = process.env.SUPABASE_STATE_ID ?? "main";
  private readonly supabaseClient: SupabaseClient | null;
  private data: Database = emptyDatabase();
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.supabaseClient = url && key ? createClient(url, key) : null;
  }

  async onModuleInit() {
    await this.load();
  }

  async read() {
    await this.ensureReady();

    if (this.driver === "supabase") {
      await this.loadSupabase();
    }

    return structuredClone(this.data);
  }

  async write(nextData: Database) {
    await this.ensureReady();
    this.data = this.normalizeDatabase(nextData);

    if (this.driver === "supabase") {
      await this.writeSupabase();
      return structuredClone(this.data);
    }

    await this.writeJsonFile();
    return structuredClone(this.data);
  }

  private async ensureReady() {
    if (!this.ready) {
      this.ready = this.load();
    }

    await this.ready;
  }

  private async load() {
    if (this.driver === "supabase") {
      await this.loadSupabase();
      return;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = this.normalizeDatabase(JSON.parse(raw) as Database);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "ENOENT") {
        throw error;
      }

      this.data = this.normalizeDatabase(seedDatabase);
      await this.writeJsonFile();
    }
  }

  private async loadSupabase() {
    const client = this.requireSupabaseClient();
    const { data, error } = await client
      .from(this.supabaseTable)
      .select("id,data")
      .eq("id", this.supabaseStateId)
      .maybeSingle<SupabaseStateRow>();

    if (error) {
      throw new Error(`Falha ao ler Supabase state: ${error.message}`);
    }

    if (data?.data) {
      this.data = this.normalizeDatabase(data.data);
      return;
    }

    this.data = this.normalizeDatabase(seedDatabase);
    await this.writeSupabase();
  }

  private async writeSupabase() {
    const client = this.requireSupabaseClient();
    const { error } = await client
      .from(this.supabaseTable)
      .upsert({
        id: this.supabaseStateId,
        data: this.data,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Falha ao gravar Supabase state: ${error.message}`);
    }
  }

  private async writeJsonFile() {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
  }

  private requireSupabaseClient() {
    if (!this.supabaseClient) {
      throw new Error("API_STORE_DRIVER=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    }

    return this.supabaseClient;
  }

  private normalizeDatabase(database: Database) {
    const nextData = structuredClone(database ?? emptyDatabase());

    nextData.users = Array.isArray(nextData.users) ? nextData.users.map((user) => {
      const role = user.role === "admin" || user.role === "partner" ? user.role : "client";

      return {
        ...user,
        role,
        hellpoints: Math.max(0, Math.floor(Number(user.hellpoints ?? 0))),
        raffleTickets: Math.max(0, Math.floor(Number(user.raffleTickets ?? 0))),
        banned: Boolean(user.banned),
        partnerCouponCode: typeof user.partnerCouponCode === "string" ? user.partnerCouponCode.trim().toUpperCase() || undefined : undefined,
        partnerDiscountPercent: Math.max(0, Math.floor(Number(user.partnerDiscountPercent ?? 0))) || undefined,
        partnerSince: typeof user.partnerSince === "string" ? user.partnerSince : undefined,
        termsAcceptedAt: typeof user.termsAcceptedAt === "string" ? user.termsAcceptedAt : undefined,
        privacyAcceptedAt: typeof user.privacyAcceptedAt === "string" ? user.privacyAcceptedAt : undefined,
        marketingEmailsOptIn: Boolean(user.marketingEmailsOptIn)
      };
    }) : [];
    nextData.categories = Array.isArray(nextData.categories) ? nextData.categories : [];
    nextData.products = Array.isArray(nextData.products) ? nextData.products : [];
    nextData.partnerPurchases = Array.isArray(nextData.partnerPurchases) ? nextData.partnerPurchases.map((purchase) => ({
      ...purchase,
      subtotalCents: Math.max(0, Math.floor(Number(purchase.subtotalCents ?? purchase.totalCents ?? 0))),
      discountCents: Math.max(0, Math.floor(Number(purchase.discountCents ?? 0))),
      totalCents: Math.max(0, Math.floor(Number(purchase.totalCents ?? 0))),
      items: Array.isArray(purchase.items) ? purchase.items : [],
      status: purchase.status === "pix_approved" ? "pix_approved" : "whatsapp_opened"
    })) : [];
    nextData.payments = Array.isArray(nextData.payments) ? nextData.payments.map((payment) => ({
      ...payment,
      provider: "mercado_pago",
      status: this.normalizePaymentStatus(payment.status),
      subtotalCents: Math.max(0, Math.floor(Number(payment.subtotalCents ?? payment.totalCents ?? 0))),
      discountCents: Math.max(0, Math.floor(Number(payment.discountCents ?? 0))),
      totalCents: Math.max(0, Math.floor(Number(payment.totalCents ?? 0))),
      cashback: Math.max(0, Math.floor(Number(payment.cashback ?? 0))),
      cashbackApplied: Boolean(payment.cashbackApplied),
      items: Array.isArray(payment.items) ? payment.items : [],
      updatedAt: typeof payment.updatedAt === "string" ? payment.updatedAt : new Date().toISOString()
    })) : [];

    return nextData;
  }

  private normalizePaymentStatus(status: unknown) {
    return status === "approved"
      || status === "rejected"
      || status === "cancelled"
      || status === "expired"
      || status === "refunded"
      ? status
      : "pending";
  }
}
