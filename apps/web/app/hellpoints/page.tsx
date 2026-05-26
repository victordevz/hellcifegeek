"use client";

import { ArrowLeft, Ticket, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";
const raffleTicketCost = 50;

type ApiProduct = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  stock: number;
  currency: "BRL";
  photoUrl: string;
  photoUrls?: string[];
  tags: string[];
  categoryId: string;
  active: boolean;
  recommended?: boolean;
};

type AuthUser = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role: "admin" | "client";
  hellpoints?: number;
  raffleTickets?: number;
};

function formatHellpoints(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(Number(value ?? 0))));
}

function productImages(product: ApiProduct) {
  const images = product.photoUrls?.length ? product.photoUrls : [product.photoUrl];
  return images.filter(Boolean);
}

function hellpointsPriceFor(product: ApiProduct) {
  return Math.round(product.priceCents / 100) * 100;
}

export default function HellpointsStorePage() {
  const router = useRouter();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const ticketDisabled = !currentUser || Number(currentUser.hellpoints ?? 0) < raffleTicketCost;
  const upcomingProducts = useMemo(() => products.filter((product) => product.active), [products]);

  async function refreshCurrentUser() {
    const token = localStorage.getItem("hellcifegeek.token");
    const storedUser = localStorage.getItem("hellcifegeek.user");

    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser) as AuthUser);
      } catch {
        localStorage.removeItem("hellcifegeek.user");
      }
    }

    if (!token) {
      return;
    }

    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const user = await response.json() as AuthUser;
    localStorage.setItem("hellcifegeek.user", JSON.stringify(user));
    setCurrentUser(user);
  }

  async function buyTicket() {
    setMessage("");
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      setMessage("Entre na conta para comprar ticket.");
      return;
    }

    const response = await fetch(`${apiUrl}/auth/me/hellpoints/tickets`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      setMessage("Hellpoints insuficientes para comprar ticket.");
      return;
    }

    const user = await response.json() as AuthUser;
    localStorage.setItem("hellcifegeek.user", JSON.stringify(user));
    setCurrentUser(user);
    setMessage("Ticket de sorteio comprado.");
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const response = await fetch(`${apiUrl}/products?active=true`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("API indisponivel");
        }

        const data = await response.json() as ApiProduct[];

        if (isMounted) {
          setProducts(data);
        }
      } catch {
        if (isMounted) {
          setProducts([]);
          setMessage("Nao foi possivel carregar a loja agora.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    void refreshCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="hellpointsPage">
      <header className="hellpointsTopbar">
        <button type="button" onClick={() => router.push("/")} aria-label="Voltar para home">
          <ArrowLeft size={22} strokeWidth={3} />
          <span>Voltar</span>
        </button>
        <div>
          <span>Saldo</span>
          <strong>{formatHellpoints(currentUser?.hellpoints)} HP</strong>
        </div>
        <div>
          <span>Tickets</span>
          <strong>{formatHellpoints(currentUser?.raffleTickets)}x</strong>
        </div>
      </header>

      <section className="hellpointsHero">
        <p>Loja Hellpoints</p>
        <h1>Troque pontos por sorteios</h1>
      </section>

      <section className="hellpointsStoreGrid">
        <article className="hellpointsTicketCard">
          <div className="ticketIcon">
            <Ticket size={58} strokeWidth={2.6} />
          </div>
          <div>
            <span>Sorteio</span>
            <h2>Ticket de sorteio</h2>
            <p>Use hellpoints para participar dos sorteios da Hellcife Geek.</p>
          </div>
          <div className="hellpointsBuyRow">
            <strong>{raffleTicketCost} hellpoints</strong>
            <button type="button" disabled={ticketDisabled} onClick={buyTicket}>
              Comprar ticket
            </button>
          </div>
        </article>

        {isLoading && (
          <div className="emptyProducts">
            <strong>Carregando loja.</strong>
            <span>Buscando itens da Hellcife Geek.</span>
          </div>
        )}

        {upcomingProducts.map((product) => (
          <article key={product.id} className="hellpointsItemCard" data-points-price={hellpointsPriceFor(product)}>
            <div className="productImage">
              <img src={productImages(product)[0]} alt={product.name} />
              <span>Em breve</span>
            </div>
            <div className="productBody">
              <div className="productMeta">
                <span>Item Hellpoints</span>
                <strong>Em breve</strong>
              </div>
              <h3>{product.name}</h3>
              <div className="productTags">
                {product.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <button type="button" disabled>
                <span>Disponivel em breve</span>
                <X size={24} strokeWidth={3} />
              </button>
            </div>
          </article>
        ))}
      </section>

      {message && <p className="hellpointsToast">{message}</p>}
    </main>
  );
}
