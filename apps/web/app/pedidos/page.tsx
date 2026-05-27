"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

type ApiProduct = {
  id: string;
  name: string;
  photoUrl: string;
  photoUrls?: string[];
  categoryId: string;
};

type OrderStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired" | "refunded";

type Order = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  cashback: number;
  items?: Array<{ productId?: string; name: string; quantity: number; priceCents: number }>;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixTicketUrl?: string;
  createdAt?: string;
  expiresAt?: string;
};

type OrderTab = "all" | "to_pay" | "to_ship" | "shipped" | "done" | "cancelled";

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value / 100);
}

function formatDate(value?: string) {
  if (!value) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function productImages(product?: ApiProduct) {
  if (!product) {
    return [];
  }

  const images = product.photoUrls?.length ? product.photoUrls : [product.photoUrl];
  return images.filter(Boolean);
}

function isExpired(order: Order) {
  return Boolean(order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now());
}

function paymentLabel(order: Order) {
  if (order.status === "approved") {
    return "Pagamento concluído";
  }

  if (order.status === "pending" && !isExpired(order)) {
    return "Pagamento pendente";
  }

  if (order.status === "expired" || isExpired(order)) {
    return "Pix expirado";
  }

  return "Pagamento não concluído";
}

function orderPhase(order: Order) {
  if (order.status === "pending" && !isExpired(order)) {
    return "A ser pago";
  }

  if (order.status === "approved") {
    return "A ser enviado";
  }

  if (order.status === "expired" || order.status === "cancelled" || order.status === "rejected" || isExpired(order)) {
    return "Cancelado";
  }

  return "Concluído";
}

function deliveryLabel(order: Order) {
  if (order.status === "approved") {
    return "Entrega aguardando separação";
  }

  if (order.status === "pending" && !isExpired(order)) {
    return "Entrega liberada após pagamento";
  }

  return "Entrega não iniciada";
}

function deliveryWhatsappUrl(order: Order) {
  const items = order.items?.map((item) => `${item.quantity}x ${item.name}`).join(", ") || "meu pedido";
  const message = `Oi, comprei ${items} na Hellcife Geek e quero combinar a entrega!`;

  return `https://wa.me/5581981472018?text=${encodeURIComponent(message)}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [activeTab, setActiveTab] = useState<OrderTab>("all");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [message, setMessage] = useState("Carregando pedidos...");

  const productsById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);
  const pendingOrders = orders.filter((order) => order.status === "pending" && !isExpired(order));
  const cancelledOrders = orders.filter((order) => order.status === "expired" || order.status === "cancelled" || order.status === "rejected" || isExpired(order));
  const filteredOrders = orders.filter((order) => {
    if (activeTab === "all") {
      return true;
    }

    if (activeTab === "to_pay") {
      return order.status === "pending" && !isExpired(order);
    }

    if (activeTab === "to_ship") {
      return order.status === "approved";
    }

    if (activeTab === "shipped") {
      return false;
    }

    if (activeTab === "cancelled") {
      return order.status === "expired" || order.status === "cancelled" || order.status === "rejected" || isExpired(order);
    }

    return order.status === "refunded";
  });
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const tabs: Array<{ id: OrderTab; label: string; count: number }> = [
    { id: "all", label: "Ver tudo", count: orders.length },
    { id: "to_pay", label: "A ser pago", count: pendingOrders.length },
    { id: "to_ship", label: "A ser enviado", count: orders.filter((order) => order.status === "approved").length },
    { id: "shipped", label: "Enviado", count: 0 },
    { id: "done", label: "Concluído", count: orders.filter((order) => order.status === "refunded").length },
    { id: "cancelled", label: "Cancelado", count: cancelledOrders.length }
  ];

  async function loadOrders() {
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      router.push("/");
      return;
    }

    try {
      const [ordersResponse, productsResponse] = await Promise.all([
        fetch(`${apiUrl}/payments`, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store"
        }),
        fetch(`${apiUrl}/products?active=true`, { cache: "no-store" })
      ]);

      if (!ordersResponse.ok) {
        throw new Error("Pedidos indisponíveis");
      }

      const nextOrders = await ordersResponse.json() as Order[];
      setOrders(nextOrders);
      setSelectedOrderId((current) => current || nextOrders.find((order) => order.status === "pending")?.id || "");

      if (productsResponse.ok) {
        setProducts(await productsResponse.json() as ApiProduct[]);
      }

      setMessage("");
    } catch {
      setMessage("Não foi possível carregar seus pedidos agora.");
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (!message || message === "Carregando pedidos...") {
      return;
    }

    const timeoutId = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  return (
    <main className="ordersPage">
      <header className="ordersTopbar">
        <button type="button" onClick={() => router.push("/")}>
          <ArrowLeft size={22} strokeWidth={3} />
          <span>Loja</span>
        </button>
      </header>

      <section className="ordersHero">
        <p>Minha conta</p>
        <h1>Produtos e pedidos</h1>
      </section>

      <section className="ordersWorkspace">
        <nav className="ordersStatusRail" aria-label="Status dos pedidos">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "isActive" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}{tab.id === "all" ? "" : ` (${tab.count})`}</span>
            </button>
          ))}
        </nav>

        <section className="ordersCatalog">
          {filteredOrders.length === 0 ? (
            <article className="ordersEmpty">
              <strong>Nenhum pedido nesse status.</strong>
              <span>Quando houver compra, ela aparece aqui com o andamento.</span>
            </article>
          ) : filteredOrders.map((order) => {
            const firstItem = order.items?.[0];
            const product = firstItem?.productId ? productsById.get(firstItem.productId) : undefined;
            const image = productImages(product)[0];

            return (
              <article key={order.id} className={`orderProductCard ${selectedOrderId === order.id ? "isSelected" : ""}`}>
                {image && <img src={image} alt={product?.name ?? firstItem?.name ?? "Produto"} />}
                <div>
                  <span>{orderPhase(order)}</span>
                  <h2>{firstItem?.name ?? "Pedido Hellcife Geek"}</h2>
                  <p>{order.items?.length ?? 0} item(ns) · {formatDate(order.createdAt)}</p>
                  <strong>{formatCents(order.totalCents)}</strong>
                </div>
                <button type="button" onClick={() => setSelectedOrderId(order.id)}>
                  Ver detalhes
                </button>
              </article>
            );
          })}
        </section>

        <aside className="orderDetailsPanel">
          {selectedOrder ? (
            <>
              <div className="orderDetailHeader">
                <span>{paymentLabel(selectedOrder)}</span>
                <strong>{formatCents(selectedOrder.totalCents)}</strong>
                <p>{deliveryLabel(selectedOrder)}</p>
              </div>

              <div className="orderTimeline">
                <span className={selectedOrder.status === "pending" || selectedOrder.status === "approved" ? "isDone" : ""}>Pedido criado</span>
                <span className={selectedOrder.status === "approved" ? "isDone" : ""}>Pagamento</span>
                <span className={selectedOrder.status === "approved" ? "isDone" : ""}>Separação</span>
                <span>Entrega</span>
              </div>

              {selectedOrder.status === "pending" && !isExpired(selectedOrder) && (
                <div className="orderPixBox">
                  <span>Pix pendente até {formatDate(selectedOrder.expiresAt)}</span>
                  <p>Finalize o pagamento na página de checkout.</p>
                  <button type="button" onClick={() => router.push(`/checkout/${selectedOrder.id}`)}>
                    Pagar agora
                  </button>
                </div>
              )}

              {selectedOrder.status === "approved" && (
                <div className="orderDeliveryBox">
                  <strong>Combine sua entrega</strong>
                  <p>Pagamento confirmado. Fale no WhatsApp para organizar o melhor horário e local da entrega.</p>
                  <a href={deliveryWhatsappUrl(selectedOrder)} target="_blank" rel="noopener noreferrer">
                    Chamar no WhatsApp
                  </a>
                </div>
              )}

              <div className="orderItemsList">
                {selectedOrder.items?.map((item) => (
                  <div key={`${selectedOrder.id}-${item.productId ?? item.name}`}>
                    <span>{item.quantity}x</span>
                    <strong>{item.name}</strong>
                    <small>{formatCents(item.priceCents * item.quantity)}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="ordersEmpty">
              <strong>Selecione um pedido.</strong>
              <span>Os detalhes de pagamento e entrega aparecem aqui.</span>
            </div>
          )}
        </aside>
      </section>

      {message && <p className="cartToast">{message}</p>}
    </main>
  );
}
