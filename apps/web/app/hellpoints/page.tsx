"use client";

import { ArrowLeft, Gamepad2, Ticket, X } from "lucide-react";
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
  role: "admin" | "client" | "partner";
  hellpoints?: number;
  raffleTickets?: number;
};

type LaunchRaffle = {
  id: string;
  title: string;
  prize: string;
  goal: number;
  registeredCount: number;
  totalTickets: number;
  userTickets: number;
  unlocked: boolean;
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
  const [launchRaffle, setLaunchRaffle] = useState<LaunchRaffle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const ticketDisabled = !currentUser || Number(currentUser.hellpoints ?? 0) < raffleTicketCost;
  const launchGoalProgress = Math.min(100, Math.round(((launchRaffle?.registeredCount ?? 0) / (launchRaffle?.goal || 125)) * 100));
  const launchEntryDisabled = !currentUser || Number(currentUser.raffleTickets ?? 0) < 1;
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
    await refreshLaunchRaffle(token);
  }

  async function refreshLaunchRaffle(authToken?: string) {
    const token = authToken ?? localStorage.getItem("hellcifegeek.token");

    if (!token) {
      return;
    }

    const response = await fetch(`${apiUrl}/auth/me/raffles/launch`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    setLaunchRaffle(await response.json() as LaunchRaffle);
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

  async function enterLaunchRaffle() {
    setMessage("");
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      setMessage("Entre na conta para usar ticket.");
      return;
    }

    const response = await fetch(`${apiUrl}/auth/me/raffles/launch/tickets`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Não foi possível participar." })) as { message?: string };
      setMessage(error.message ?? "Não foi possível participar.");
      return;
    }

    const data = await response.json() as { user: AuthUser; raffle: LaunchRaffle };
    localStorage.setItem("hellcifegeek.user", JSON.stringify(data.user));
    setCurrentUser(data.user);
    setLaunchRaffle(data.raffle);
    setMessage("Ticket colocado no sorteio de lançamento.");
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
    void refreshLaunchRaffle();

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

        <article className="launchRaffleCard">
          <div className="launchRaffleIcon">
            <Gamepad2 size={54} strokeWidth={2.4} />
          </div>
          <div>
            <span>Sorteio de lançamento</span>
            <h2>Controle 8BitDo original</h2>
            <p>Meta de 125 cadastros para liberar o sorteio. Use seus tickets para colocar seu nome mais vezes.</p>
          </div>
          <div className="launchRaffleProgress" aria-label={`${launchGoalProgress}% da meta de cadastros`}>
            <div>
              <strong>{formatHellpoints(launchRaffle?.registeredCount)} / {formatHellpoints(launchRaffle?.goal ?? 125)}</strong>
              <span>cadastros</span>
            </div>
            <div className="launchRaffleBar">
              <span style={{ width: `${launchGoalProgress}%` }} />
            </div>
          </div>
          <div className="launchRaffleStats">
            <strong>{formatHellpoints(launchRaffle?.userTickets)}x</strong>
            <span>tickets seus no sorteio</span>
            <strong>{formatHellpoints(launchRaffle?.totalTickets)}x</strong>
            <span>tickets totais</span>
          </div>
          <button type="button" disabled={launchEntryDisabled} onClick={enterLaunchRaffle}>
            Usar ticket neste sorteio
          </button>
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
