"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

type PartnerUser = {
  id: string;
  name?: string;
  email: string;
  role: "admin" | "client" | "partner";
  partnerCouponCode?: string;
  partnerDiscountPercent?: number;
};

type PartnerPurchase = {
  id: string;
  customerName?: string;
  customerEmail: string;
  couponCode: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  items: Array<{
    name: string;
    quantity: number;
    priceCents: number;
  }>;
  createdAt: string;
};

type PartnerDashboard = {
  partner: PartnerUser;
  purchases: PartnerPurchase[];
  summary: {
    purchaseCount: number;
    itemCount: number;
    totalCents: number;
    discountCents: number;
    commissionRate: number;
    commissionCents: number;
    categoryBreakdown: Array<{
      categoryId?: string;
      categoryName: string;
      quantity: number;
      totalCents: number;
    }>;
  };
};

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function PartnerPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("Carregando painel...");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const averageTicket = useMemo(() => {
    if (!dashboard?.summary.purchaseCount) {
      return 0;
    }

    return Math.round(dashboard.summary.totalCents / dashboard.summary.purchaseCount);
  }, [dashboard]);

  async function loadDashboard(authToken: string, filters = { startDate, endDate }) {
    const params = new URLSearchParams();

    if (filters.startDate) {
      params.set("startDate", filters.startDate);
    }

    if (filters.endDate) {
      params.set("endDate", filters.endDate);
    }

    const query = params.toString();
    const response = await fetch(`${apiUrl}/auth/partner/dashboard${query ? `?${query}` : ""}`, {
      headers: { authorization: `Bearer ${authToken}` },
      cache: "no-store"
    });

    if (!response.ok) {
      setErrorMessage(response.status === 400 ? "Período inválido." : "Acesso permitido apenas para parceiros.");
      setToastMessage("");
      return;
    }

    const data = await response.json() as PartnerDashboard;
    setDashboard(data);
    localStorage.setItem("hellcifegeek.user", JSON.stringify(data.partner));
    setErrorMessage("");
    setToastMessage("");
  }

  useEffect(() => {
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      router.push("/");
      return;
    }

    void loadDashboard(token, { startDate: "", endDate: "" });
  }, [router]);

  async function applyDateFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      router.push("/");
      return;
    }

    setErrorMessage("");
    setToastMessage("Atualizando período...");
    await loadDashboard(token, { startDate, endDate });
  }

  async function clearDateFilter() {
    const token = localStorage.getItem("hellcifegeek.token");
    setStartDate("");
    setEndDate("");

    if (!token) {
      router.push("/");
      return;
    }

    setErrorMessage("");
    setToastMessage("Atualizando período...");
    await loadDashboard(token, { startDate: "", endDate: "" });
  }

  async function applyQuickFilter(period: "daily" | "weekly" | "monthly") {
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      router.push("/");
      return;
    }

    const today = new Date();
    let nextStartDate = toDateInputValue(today);
    const nextEndDate = toDateInputValue(today);

    if (period === "weekly") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      nextStartDate = toDateInputValue(weekStart);
    }

    if (period === "monthly") {
      nextStartDate = toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setErrorMessage("");
    setToastMessage("Atualizando período...");
    await loadDashboard(token, { startDate: nextStartDate, endDate: nextEndDate });
  }

  function logout() {
    localStorage.removeItem("hellcifegeek.token");
    localStorage.removeItem("hellcifegeek.user");
    router.push("/");
  }

  return (
    <main className="partnerShell">
      <header className="partnerTopbar">
        <a href="/">Hellcife Geek</a>
        <div>
          <button type="button" onClick={() => router.push("/")}>Loja</button>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </header>

      <section className="partnerHero">
        <div>
          <span>Painel de parceria</span>
          <h1>{dashboard?.partner.name || dashboard?.partner.email || "Parceiro"}</h1>
        </div>
        <div className="partnerCoupon">
          <span>Cupom ativo</span>
          <strong>{dashboard?.partner.partnerCouponCode ?? "--"}</strong>
          <small>{dashboard?.partner.partnerDiscountPercent ?? 10}% OFF para clientes</small>
        </div>
      </section>

      {errorMessage && <p className="adminNotice">{errorMessage}</p>}
      {toastMessage && <div className="partnerToast" role="status">{toastMessage}</div>}

      {dashboard && (
        <>
          <form className="partnerFilters" onSubmit={applyDateFilter}>
            <div className="partnerQuickFilters" aria-label="Filtros rapidos">
              <button type="button" onClick={() => applyQuickFilter("daily")}>Diario</button>
              <button type="button" onClick={() => applyQuickFilter("weekly")}>Semanal</button>
              <button type="button" onClick={() => applyQuickFilter("monthly")}>Mensal</button>
            </div>
            <label>
              De
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              Ate
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <button type="submit">Filtrar</button>
            <button type="button" onClick={clearDateFilter}>Limpar</button>
          </form>

          <section className="partnerStats">
            <article>
              <span>Compras com cupom</span>
              <strong>{dashboard.summary.purchaseCount}</strong>
            </article>
            <article>
              <span>Total vendido</span>
              <strong>{formatCents(dashboard.summary.totalCents)}</strong>
            </article>
            <article>
              <span>Valor a receber</span>
              <strong>{formatCents(dashboard.summary.commissionCents)}</strong>
              <small>{dashboard.summary.commissionRate}% do total vendido · Pix em até 15 dias, cartão em até 30 dias</small>
            </article>
            <article>
              <span>Ticket medio</span>
              <strong>{formatCents(averageTicket)}</strong>
            </article>
            <article>
              <span>Itens vendidos</span>
              <strong>{dashboard.summary.itemCount}</strong>
            </article>
            <article>
              <span>Descontos gerados</span>
              <strong>{formatCents(dashboard.summary.discountCents)}</strong>
            </article>
          </section>

          <section className="partnerInsights">
            <div className="adminCardHeader">
              <div>
                <span>Insights</span>
                <h2>Vendas por categoria</h2>
              </div>
            </div>

            <div className="partnerCategoryGrid">
              {dashboard.summary.categoryBreakdown.map((category) => (
                <article key={category.categoryId ?? category.categoryName}>
                  <span>{category.categoryName}</span>
                  <strong>{category.quantity}</strong>
                  <small>{formatCents(category.totalCents)} vendidos</small>
                </article>
              ))}
              {dashboard.summary.categoryBreakdown.length === 0 && (
                <p className="adminEmpty">As categorias aparecem aqui quando houver vendas com seu cupom.</p>
              )}
            </div>
          </section>

          <section className="partnerTable">
            <div className="adminCardHeader">
              <div>
                <span>Historico</span>
                <h2>Compras feitas com seu código</h2>
              </div>
            </div>

            {dashboard.purchases.map((purchase) => (
              <article key={purchase.id}>
                <div>
                  <strong>{purchase.customerName || purchase.customerEmail}</strong>
                  <span>{formatDate(purchase.createdAt)} · Cupom {purchase.couponCode}</span>
                  <small>{purchase.items.map((item) => `${item.quantity}x ${item.name}`).join(", ") || "Itens enviados pelo WhatsApp"}</small>
                </div>
                <div>
                  <span>Subtotal</span>
                  <strong>{formatCents(purchase.subtotalCents)}</strong>
                </div>
                <div>
                  <span>Desconto</span>
                  <strong>{formatCents(purchase.discountCents)}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatCents(purchase.totalCents)}</strong>
                </div>
              </article>
            ))}

            {dashboard.purchases.length === 0 && <p className="adminEmpty">Nenhuma compra registrada com seu cupom ainda.</p>}
          </section>
        </>
      )}
    </main>
  );
}
