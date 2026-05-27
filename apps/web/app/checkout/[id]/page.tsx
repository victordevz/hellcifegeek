"use client";

import { ArrowLeft, CheckCircle2, Copy, ExternalLink, RotateCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired" | "refunded";

type Payment = {
  id: string;
  status: PaymentStatus;
  totalCents: number;
  cashback: number;
  items?: Array<{ productId?: string; name: string; quantity: number; priceCents: number }>;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixTicketUrl?: string;
  createdAt?: string;
  expiresAt?: string;
};

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value / 100);
}

function formatDate(value?: string) {
  if (!value) {
    return "até expirar";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function isExpired(payment: Payment | null) {
  return Boolean(payment?.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now());
}

function paymentTitle(payment: Payment | null) {
  if (!payment) {
    return "Carregando pagamento";
  }

  if (payment.status === "approved") {
    return "Pagamento aprovado";
  }

  if (payment.status === "pending" && !isExpired(payment)) {
    return "Pague com Pix";
  }

  return "Pagamento indisponível";
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const paymentId = params.id;
  const [payment, setPayment] = useState<Payment | null>(null);
  const [message, setMessage] = useState("Carregando checkout...");
  const canPay = payment?.status === "pending" && !isExpired(payment);

  async function loadPayment(redirectToOrders = false) {
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      router.push("/");
      return;
    }

    const response = await fetch(`${apiUrl}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!response.ok) {
      setMessage("Não foi possível carregar esse pagamento.");
      return;
    }

    const nextPayment = await response.json() as Payment;
    setPayment(nextPayment);
    setMessage("");

    if (redirectToOrders) {
      router.push("/pedidos");
    }
  }

  async function copyPixCode() {
    if (!payment?.pixQrCode) {
      return;
    }

    await navigator.clipboard.writeText(payment.pixQrCode);
    setMessage("Código Pix copiado.");
  }

  useEffect(() => {
    void loadPayment();
  }, [paymentId]);

  useEffect(() => {
    if (!payment || payment.status !== "pending" || isExpired(payment)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadPayment();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [payment?.id, payment?.status, payment?.expiresAt]);

  useEffect(() => {
    if (!message || message === "Carregando checkout...") {
      return;
    }

    const timeoutId = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  return (
    <main className="checkoutPage">
      <header className="checkoutTopbar">
        <button type="button" onClick={() => router.push("/")}>
          <ArrowLeft size={20} strokeWidth={3} />
          Loja
        </button>
        <button type="button" onClick={() => router.push("/pedidos")}>
          Verificar status da compra
        </button>
      </header>

      <section className="checkoutShell">
        <div className="checkoutSummary">
          <span>Checkout Pix</span>
          <h1>{paymentTitle(payment)}</h1>
          <strong>{payment ? formatCents(payment.totalCents) : "..."}</strong>
          <p>{canPay ? `Pix disponível até ${formatDate(payment.expiresAt)}.` : "Acompanhe o status do pedido na página de pedidos."}</p>

          <div className="checkoutItems">
            {payment?.items?.map((item) => (
              <div key={`${payment.id}-${item.productId ?? item.name}`}>
                <span>{item.quantity}x</span>
                <strong>{item.name}</strong>
                <small>{formatCents(item.priceCents * item.quantity)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="checkoutPaymentBox">
          {canPay ? (
            <>
              {payment.pixQrCodeBase64 && <img src={`data:image/png;base64,${payment.pixQrCodeBase64}`} alt="QR Code Pix" />}
              <button type="button" onClick={copyPixCode}>
                <Copy size={18} strokeWidth={3} />
                Copiar código Pix
              </button>
              {payment.pixTicketUrl && (
                <a href={payment.pixTicketUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={18} strokeWidth={3} />
                  Abrir Mercado Pago
                </a>
              )}
              <button type="button" className="secondary" onClick={() => loadPayment(true)}>
                <RotateCw size={18} strokeWidth={3} />
                Verificar status da compra
              </button>
            </>
          ) : (
            <div className="checkoutState">
              <CheckCircle2 size={44} strokeWidth={2.6} />
              <strong>{payment?.status === "approved" ? "Pagamento aprovado" : "Pix expirado ou indisponível"}</strong>
              <button type="button" onClick={() => router.push("/pedidos")}>Ver status da compra</button>
            </div>
          )}
        </div>
      </section>

      {message && <p className="cartToast">{message}</p>}
    </main>
  );
}
