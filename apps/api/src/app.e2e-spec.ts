import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import request from "supertest";
import { AppModule } from "./app.module";

type Session = {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    hellpoints?: number;
    raffleTickets?: number;
    partnerCouponCode?: string;
    partnerDiscountPercent?: number;
  };
};

type CreatedProduct = {
  id: string;
  name: string;
  priceCents: number;
  photoUrl: string;
  categoryId: string;
};

const testRoot = join(process.cwd(), ".tmp-test");
const dbPath = join(testRoot, `db-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
const adminEmail = "admin@hellcifegeek.com.br";
const adminPassword = "Admin-Test-Password-12345";

describe("Hellcife Geek API", () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  let admin: Session;
  let client: Session;
  let partner: Session;
  let categoryId = "";
  let product: CreatedProduct;
  let paymentId = "";

  beforeAll(async () => {
    process.env.API_STORE_DRIVER = "json";
    process.env.API_DB_PATH = dbPath;
    process.env.ADMIN_EMAIL = adminEmail;
    process.env.ADMIN_PASSWORD = adminPassword;
    process.env.AUTH_SECRET = "test-secret";
    process.env.GOOGLE_CLIENT_ID = "google-client-test";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret-test";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/callback/google";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "test-mp-token";
    process.env.MERCADO_PAGO_WEBHOOK_URL = "https://api.test/payments/mercado-pago/webhook";
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.RESEND_FROM_EMAIL = "Hellcife Geek <contato@hellcifegeek.com>";
    process.env.RESEND_ADMIN_EMAIL = "contato@victorcorreia.dev";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await mkdir(testRoot, { recursive: true });

    jest.spyOn(global, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);

      if (url.includes("oauth2.googleapis.com/token")) {
        return jsonResponse({ access_token: "google-access-token" });
      }

      if (url.includes("www.googleapis.com/oauth2/v3/userinfo")) {
        return jsonResponse({
          sub: "google-user-test",
          email: "google@test.local",
          email_verified: true,
          name: "Google Teste"
        });
      }

      if (url.includes("api.mercadopago.com/v1/payments") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { date_of_expiration?: string };
        expect(new Date(body.date_of_expiration ?? "").getTime()).toBeGreaterThanOrEqual(Date.now() + 29 * 60 * 1000);

        return jsonResponse({
          id: 987654,
          status: "pending",
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          point_of_interaction: {
            transaction_data: {
              qr_code: "000201PIXTEST",
              qr_code_base64: "ZmFrZS1xcg==",
              ticket_url: "https://mercadopago.test/pix"
            }
          }
        });
      }

      if (url.includes("api.mercadopago.com/v1/payments/987654")) {
        return jsonResponse({
          id: 987654,
          status: "approved",
          date_approved: new Date().toISOString()
        });
      }

      if (url.includes("api.resend.com/emails")) {
        return jsonResponse({ id: crypto.randomUUID() });
      }

      return jsonResponse({ message: `Unexpected fetch ${url}` }, false, 500);
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
    httpServer = app.getHttpAdapter().getInstance();
  });

  afterAll(async () => {
    await app?.close();
    await rm(testRoot, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it("exposes health", async () => {
    const response = await request(httpServer).get("/api/health").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      service: "hellcifegeek-api"
    });
    expect(response.body.timestamp).toBeTruthy();
  });

  it("authenticates default admin and protects admin routes", async () => {
    await request(httpServer).get("/api/auth/admin/users").expect(403);

    const response = await request(httpServer)
      .post("/api/auth/admin/login")
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);

    admin = response.body as Session;
    expect(admin.token).toBeTruthy();
    expect(admin.user.role).toBe("admin");
  });

  it("registers, logs in, updates profile and rejects duplicate email", async () => {
    const payload = {
      name: "Cliente Teste",
      email: "cliente@test.local",
      password: "client-password",
      phone: "81999990000",
      termsAccepted: true,
      marketingEmailsOptIn: true
    };

    const registerResponse = await request(httpServer).post("/api/auth/register").send(payload).expect(201);
    client = registerResponse.body as Session;
    expect(client.user.hellpoints).toBe(50);
    expect(client.user.raffleTickets).toBe(0);

    await request(httpServer).post("/api/auth/register").send(payload).expect(409);

    const loginResponse = await request(httpServer)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password })
      .expect(201);
    expect(loginResponse.body.user.email).toBe(payload.email);

    const meResponse = await request(httpServer)
      .patch("/api/auth/me")
      .set(auth(client))
      .send({ phone: "81888887777" })
      .expect(200);
    expect(meResponse.body.phone).toBe("81888887777");
  });

  it("supports Google OAuth redirect and callback registration", async () => {
    const redirect = await request(httpServer)
      .get("/api/auth/google?redirect_uri=http://localhost:3000/api/auth/callback/google&state=abc")
      .expect(302);
    expect(redirect.headers.location).toContain("accounts.google.com");
    expect(redirect.headers.location).toContain("state=abc");

    const callback = await request(httpServer)
      .post("/api/auth/google/callback")
      .send({ code: "valid-code", redirectUri: "http://localhost:3000/api/auth/callback/google" })
      .expect(201);
    expect(callback.body.user.email).toBe("google@test.local");
    expect(callback.body.token).toBeTruthy();
  });

  it("creates and manages categories", async () => {
    const created = await request(httpServer)
      .post("/api/categories")
      .set(auth(admin))
      .send({ name: "Canecas", description: "Itens colecionaveis" })
      .expect(201);

    categoryId = created.body.id;
    expect(created.body.slug).toBe("canecas");

    const updated = await request(httpServer)
      .patch(`/api/categories/${categoryId}`)
      .set(auth(admin))
      .send({ name: "Colecionáveis" })
      .expect(200);
    expect(updated.body.slug).toBe("colecionaveis");

    const list = await request(httpServer).get("/api/categories").expect(200);
    expect(list.body.some((category: { id: string }) => category.id === categoryId)).toBe(true);
  });

  it("creates, filters, updates and protects products", async () => {
    await request(httpServer)
      .post("/api/products")
      .send({ name: "Sem auth" })
      .expect(403);

    const created = await request(httpServer)
      .post("/api/products")
      .set(auth(admin))
      .send({
        name: "Produto Teste",
        description: "Descricao teste",
        price: 42.9,
        stock: 3,
        photoUrl: "https://example.com/produto.png",
        photoUrls: ["https://example.com/produto.png"],
        tags: "teste, raro",
        categoryId,
        active: true,
        recommended: false
      })
      .expect(201);

    product = created.body as CreatedProduct;
    expect(product.priceCents).toBe(4290);

    await request(httpServer)
      .patch(`/api/products/${product.id}/recommended`)
      .set(auth(admin))
      .send({ recommended: true })
      .expect(200);

    const filtered = await request(httpServer).get("/api/products?active=true&recommended=true&q=produto").expect(200);
    expect(filtered.body.some((item: CreatedProduct) => item.id === product.id)).toBe(true);

    const found = await request(httpServer).get(`/api/products/${product.id}`).expect(200);
    expect(found.body.id).toBe(product.id);

    const updated = await request(httpServer)
      .patch(`/api/products/${product.id}`)
      .set(auth(admin))
      .send({ price: 49.9, stock: 4 })
      .expect(200);
    expect(updated.body.priceCents).toBe(4990);
    expect(updated.body.stock).toBe(4);
  });

  it("turns a user into partner, validates 10 percent coupon and blocks duplicate coupon", async () => {
    const partnerRegister = await request(httpServer)
      .post("/api/auth/register")
      .send({
        name: "Parceiro Teste",
        email: "parceiro@test.local",
        password: "partner-password",
        termsAccepted: true
      })
      .expect(201);
    partner = partnerRegister.body as Session;

    const partnerResponse = await request(httpServer)
      .patch(`/api/auth/admin/users/${partner.user.id}/partner`)
      .set(auth(admin))
      .send({ partner: true, couponCode: "PARCEIRO10" })
      .expect(200);
    expect(partnerResponse.body.role).toBe("partner");
    expect(partnerResponse.body.partnerDiscountPercent).toBe(10);

    const coupon = await request(httpServer).get("/api/auth/coupons/PARCEIRO10").expect(200);
    expect(coupon.body).toMatchObject({
      code: "PARCEIRO10",
      discountPercent: 10,
      partnerName: "Parceiro Teste"
    });
    await request(httpServer).get("/api/auth/coupons/INVALIDO").expect(400);

    await request(httpServer)
      .patch(`/api/auth/admin/users/${client.user.id}/partner`)
      .set(auth(admin))
      .send({ partner: true, couponCode: "PARCEIRO10" })
      .expect(400);
  });

  it("handles Hellpoints raffle ticket purchase and launch raffle entry", async () => {
    const ticketResponse = await request(httpServer)
      .post("/api/auth/me/hellpoints/tickets")
      .set(auth(client))
      .expect(201);

    client.user = ticketResponse.body;
    expect(client.user.hellpoints).toBe(0);
    expect(client.user.raffleTickets).toBe(1);

    const entryResponse = await request(httpServer)
      .post("/api/auth/me/raffles/launch/tickets")
      .set(auth(client))
      .expect(201);

    client.user = entryResponse.body.user;
    expect(client.user.raffleTickets).toBe(0);
    expect(entryResponse.body.raffle.userTickets).toBe(1);
    expect(entryResponse.body.raffle.goal).toBe(125);

    const adminRaffle = await request(httpServer)
      .get("/api/auth/admin/raffles/launch")
      .set(auth(admin))
      .expect(200);
    expect(adminRaffle.body.participants).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: "cliente@test.local", ticketCount: 1 })
    ]));
  });

  it("tracks cart activity for abandoned cart reminders", async () => {
    const tracked = await request(httpServer)
      .post("/api/payments/cart-activity")
      .set(auth(client))
      .send({
        items: [{ productId: product.id, name: product.name, quantity: 1, priceCents: 4990 }]
      })
      .expect(201);
    expect(tracked.body.tracked).toBe(true);
    expect(tracked.body.remindAfter).toBeTruthy();

    const reservedProduct = await request(httpServer).get(`/api/products/${product.id}`).expect(200);
    expect(reservedProduct.body.stock).toBe(3);

    const cleared = await request(httpServer)
      .post("/api/payments/cart-activity")
      .set(auth(client))
      .send({ items: [] })
      .expect(201);
    expect(cleared.body.tracked).toBe(false);

    const releasedProduct = await request(httpServer).get(`/api/products/${product.id}`).expect(200);
    expect(releasedProduct.body.stock).toBe(4);
  });

  it("creates Pix payment, reuses pending payment, approves webhook and records partner dashboard", async () => {
    const createPayment = await request(httpServer)
      .post("/api/payments/pix")
      .set(auth(client))
      .send({
        subtotalCents: 4990,
        totalCents: 4491,
        couponCode: "PARCEIRO10",
        items: [{ productId: product.id, name: product.name, quantity: 1, priceCents: 4990 }]
      })
      .expect(201);

    paymentId = createPayment.body.id;
    expect(createPayment.body.status).toBe("pending");
    expect(createPayment.body.pixQrCode).toBe("000201PIXTEST");
    expect(new Date(createPayment.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(createPayment.body.expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 2000);

    const reservedProduct = await request(httpServer).get(`/api/products/${product.id}`).expect(200);
    expect(reservedProduct.body.stock).toBe(3);

    const reused = await request(httpServer)
      .post("/api/payments/pix")
      .set(auth(client))
      .send({
        subtotalCents: 4990,
        totalCents: 4491,
        couponCode: "PARCEIRO10",
        items: [{ productId: product.id, name: product.name, quantity: 1, priceCents: 4990 }]
      })
      .expect(201);
    expect(reused.body.id).toBe(paymentId);
    expect(reused.body.reusedPending).toBe(true);

    await request(httpServer)
      .post("/api/payments/mercado-pago/webhook?id=987654")
      .send({ type: "payment" })
      .expect(201);

    const payment = await request(httpServer)
      .get(`/api/payments/${paymentId}`)
      .set(auth(client))
      .expect(200);
    expect(payment.body.status).toBe("approved");
    expect(payment.body.cashback).toBe(449);

    const payments = await request(httpServer).get("/api/payments").set(auth(client)).expect(200);
    expect(payments.body.some((item: { id: string; status: string }) => item.id === paymentId && item.status === "approved")).toBe(true);

    const updatedClient = await request(httpServer).get("/api/auth/me").set(auth(client)).expect(200);
    expect(updatedClient.body.hellpoints).toBe(449);

    const soldProduct = await request(httpServer).get(`/api/products/${product.id}`).expect(200);
    expect(soldProduct.body.stock).toBe(3);

    const salesReport = await request(httpServer)
      .get("/api/payments/admin/sales-report")
      .set(auth(admin))
      .expect(200);
    expect(salesReport.body.summary.saleCount).toBe(1);
    expect(salesReport.body.summary.totalCents).toBe(4491);
    expect(salesReport.body.summary.activeReservationCount).toBe(0);
    expect(salesReport.body.sales[0]).toMatchObject({
      paymentId,
      totalCents: 4491,
      userEmail: "cliente@test.local"
    });

    const partnerLogin = await request(httpServer)
      .post("/api/auth/login")
      .send({ email: "parceiro@test.local", password: "partner-password" })
      .expect(201);
    partner = partnerLogin.body as Session;

    const dashboard = await request(httpServer)
      .get("/api/auth/partner/dashboard")
      .set(auth(partner))
      .expect(200);
    expect(dashboard.body.summary.purchaseCount).toBe(1);
    expect(dashboard.body.summary.commissionRate).toBe(5);
    expect(dashboard.body.summary.commissionCents).toBe(Math.round(4491 * 0.05));
  });

  it("supports admin user actions and upload guard", async () => {
    const disposable = await request(httpServer)
      .post("/api/auth/register")
      .send({
        name: "Usuario Descartavel",
        email: "delete-me@test.local",
        password: "delete-password",
        termsAccepted: true
      })
      .expect(201);

    await request(httpServer)
      .patch(`/api/auth/admin/users/${disposable.body.user.id}/ban`)
      .set(auth(admin))
      .send({ banned: true })
      .expect(200);

    await request(httpServer)
      .delete(`/api/auth/admin/users/${disposable.body.user.id}`)
      .set(auth(admin))
      .expect(200);

    await request(httpServer).get("/api/uploads/storage-status").expect(403);
    await request(httpServer).get("/api/uploads/storage-status").set(auth(admin)).expect(503);
    await request(httpServer)
      .post("/api/uploads/product-image")
      .set(auth(admin))
      .send({ fileName: "teste.png", contentType: "image/png", base64: "data:image/png;base64,AAAA" })
      .expect(503);

    await request(httpServer).delete(`/api/products/${product.id}`).set(auth(admin)).expect(200);
    await request(httpServer).delete(`/api/categories/${categoryId}`).set(auth(admin)).expect(200);
  });
});

function auth(session: Session) {
  return { authorization: `Bearer ${session.token}` };
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response);
}
