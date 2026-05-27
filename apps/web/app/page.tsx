"use client";

import gsap from "gsap";
import type { FormEvent } from "react";
import { ArrowUp, ArrowUpRight, Clock3, Eye, EyeOff, Minus, Plus, ShoppingCart, Ticket, Trash2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const services = [
  {
    number: "01",
    title: "Marketplace Ops",
    tags: ["Discovery", "Trust", "Fees", "Ranking"]
  },
  {
    number: "02",
    title: "Seller Systems",
    tags: ["Profiles", "Policies", "Reviews", "Disputes"]
  },
  {
    number: "03",
    title: "Checkout Logic",
    tags: ["Taxes", "Escrow", "Errors", "Receipts"]
  },
  {
    number: "04",
    title: "Growth Loops",
    tags: ["Saved", "Referrals", "Prompts", "Analytics"]
  }
];

const navItems = [
  { label: "Home", targetId: "top" },
  { label: "Produtos", targetId: "work" },
  { label: "Promo", targetId: "contact" }
];

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";
const productsPerPage = 6;
const cartStorageKey = "hellcifegeek.cart";
const pendingPixStorageKey = "hellcifegeek.pendingPix";
const phoneCouponCode = "CELULAR5";
const phoneCouponDiscountRate = 0.05;

type ApiCategory = {
  id: string;
  name: string;
};

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
  partnerCouponCode?: string;
  partnerDiscountPercent?: number;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type PixPayment = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired" | "refunded";
  totalCents: number;
  cashback: number;
  items?: Array<{ productId?: string; name: string; quantity: number; priceCents: number }>;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixTicketUrl?: string;
  createdAt?: string;
  expiresAt?: string;
  reusedPending?: boolean;
};

function formatPrice(product: ApiProduct) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: product.currency
  }).format(product.priceCents / 100);
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value / 100);
}

function isPendingPixExpired(payment: PixPayment | null) {
  return Boolean(payment?.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now());
}

function formatHellpoints(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(Number(value ?? 0))));
}

function cashbackFor(totalCents: number) {
  return Math.round(totalCents / 100) * 10;
}

function productImages(product: ApiProduct) {
  const images = product.photoUrls?.length ? product.photoUrls : [product.photoUrl];
  return images.filter(Boolean);
}

function stockFor(product: ApiProduct) {
  return Math.max(0, Math.floor(Number(product.stock ?? 0)));
}

function stockLabel(product: ApiProduct) {
  const stock = stockFor(product);

  if (!product.active || stock === 0) {
    return "Indisponivel";
  }

  return stock <= 5 ? "Estoque limitado" : `${stock} em estoque`;
}

function ChromeMark() {
  return (
    <svg className="brandIcon googleMark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.16 10.2v4.15h5.78c-.25 1.34-1 2.47-2.12 3.23v2.69h3.44c2.02-1.87 3.18-4.62 3.18-7.88 0-.75-.07-1.48-.2-2.19H12.16Z" />
      <path d="M6.14 14.18 5.36 14.78 2.61 16.92C4.36 20.39 7.95 22.8 12.16 22.8c2.89 0 5.31-.95 7.1-2.53l-3.44-2.69c-.95.64-2.17 1.02-3.66 1.02-2.79 0-5.15-1.88-5.99-4.42h-.03Z" />
      <path d="M2.61 7.08A10.62 10.62 0 0 0 1.48 12c0 1.77.42 3.45 1.13 4.92l3.56-2.74A6.38 6.38 0 0 1 5.83 12c0-.76.13-1.49.34-2.18L2.61 7.08Z" />
      <path d="M12.16 5.4c1.57 0 2.98.54 4.09 1.6l3.08-3.08C17.47 2.17 15.05 1.2 12.16 1.2 7.95 1.2 4.36 3.61 2.61 7.08l3.56 2.74c.84-2.54 3.2-4.42 5.99-4.42Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg className="brandIcon appleMark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M11.18.01c-.03-.04-1.26.01-2.32 1.17-1.07 1.16-.91 2.48-.88 2.52.02.03 1.52.09 2.47-1.26.96-1.35.77-2.39.73-2.43Zm3.32 11.73c-.05-.1-2.33-1.23-2.12-3.42.21-2.19 1.68-2.79 1.7-2.85.02-.07-.6-.79-1.25-1.16a3.7 3.7 0 0 0-1.57-.43c-.1 0-.48-.1-1.25.11-.51.14-1.65.59-1.97.61-.32.02-1.26-.52-2.27-.67-.65-.12-1.33.13-1.82.33-.49.2-1.42.75-2.07 2.24-.65 1.48-.31 3.83-.07 4.56.24.73.62 1.92 1.27 2.8.58.98 1.34 1.66 1.66 1.9.32.23 1.22.38 1.84.06.51-.3 1.41-.48 1.77-.47.36.02 1.06.16 1.78.54.57.2 1.11.12 1.65-.1.54-.22 1.32-1.06 2.24-2.76.35-.79.51-1.22.48-1.29Z" />
    </svg>
  );
}

function RotatingScrollIndicator({ onClick }: { onClick: () => void }) {
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const indicator = indicatorRef.current;
    const arrow = arrowRef.current;

    if (!indicator || !arrow) {
      return;
    }

    gsap.set(arrow, {
      rotation: 0,
      transformOrigin: "50% 50%",
      y: -4
    });

    const rotateDown = () => {
      gsap.to(arrow, {
        duration: 0.5,
        ease: "power3.out",
        rotation: 180,
        transformOrigin: "50% 50%",
        y: 3
      });
    };

    const rotateUp = () => {
      gsap.to(arrow, {
        duration: 0.5,
        ease: "power3.out",
        rotation: 0,
        transformOrigin: "50% 50%",
        y: -4
      });
    };

    indicator.addEventListener("pointerenter", rotateDown);
    indicator.addEventListener("pointerleave", rotateUp);
    indicator.addEventListener("focus", rotateDown);
    indicator.addEventListener("blur", rotateUp);

    return () => {
      indicator.removeEventListener("pointerenter", rotateDown);
      indicator.removeEventListener("pointerleave", rotateUp);
      indicator.removeEventListener("focus", rotateDown);
      indicator.removeEventListener("blur", rotateUp);
    };
  }, []);

  return (
    <button ref={indicatorRef} type="button" className="scrollIndicator" onClick={onClick} aria-label="Descer para produtos">
      <svg className="scrollText" viewBox="0 0 144 144" aria-hidden="true">
        <defs>
          <path id="scroll-path" d="M72 72 m -53 0 a 53 53 0 1 1 106 0 a 53 53 0 1 1 -106 0" />
        </defs>
        <text>
          <textPath href="#scroll-path">Scroll Down • Scroll Down • Scroll Down • Scroll Down • </textPath>
        </text>
      </svg>
      <span ref={arrowRef} className="scrollArrow">
        <ArrowUp size={34} strokeWidth={2.5} />
      </span>
    </button>
  );
}

function HeroHeadline() {
  return (
    <div className="heroHeadline" aria-label="HELLCIFE GEEK">
      <h1 className="mainHeadline">HELLCIFE GEEK</h1>
      <h1 className="altHeadline" aria-hidden="true">DROP POKEMON</h1>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(productsPerPage);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPhone, setAccountPhone] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [isAccountPhoneEditing, setIsAccountPhoneEditing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [appliedCouponDiscountRate, setAppliedCouponDiscountRate] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [productQuantity, setProductQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [isCreatingPix, setIsCreatingPix] = useState(false);
  const [orders, setOrders] = useState<PixPayment[]>([]);
  const [raffleModalOpen, setRaffleModalOpen] = useState(false);
  const [raffleMessage, setRaffleMessage] = useState("");
  const [isBuyingRaffleTicket, setIsBuyingRaffleTicket] = useState(false);
  const loginModalRef = useRef<HTMLDivElement>(null);
  const signupModalRef = useRef<HTMLDivElement>(null);
  const categoriesById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);
  const filterOptions = useMemo(() => {
    return ["All", "Recommended", ...categories.map((category) => category.name)];
  }, [categories]);
  const visibleProducts = useMemo(() => {
    if (activeCategory === "All") {
      return products;
    }

    if (activeCategory === "Recommended") {
      return products.filter((product) => product.recommended);
    }

    return products.filter((product) => categoriesById.get(product.categoryId) === activeCategory);
  }, [activeCategory, categoriesById, products]);
  const displayedProducts = visibleProducts.slice(0, visibleCount);
  const canShowMore = visibleCount < visibleProducts.length;
  const productsById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);
  const cartLines = cartItems
    .map((item) => {
      const product = productsById.get(item.productId);
      return product ? { item, product } : null;
    })
    .filter((line): line is { item: CartItem; product: ApiProduct } => Boolean(line));
  const cartCount = cartLines.reduce((total, line) => total + line.item.quantity, 0);
  const cartTotalCents = cartLines.reduce((total, line) => total + line.product.priceCents * line.item.quantity, 0);
  const cartActivityItems = useMemo(() => cartLines.map((line) => ({
    productId: line.product.id,
    name: line.product.name,
    quantity: line.item.quantity,
    priceCents: line.product.priceCents
  })), [cartItems, productsById]);
  const hasPhoneCoupon = Boolean(currentUser?.phone);
  const couponDiscountCents = appliedCouponCode ? Math.round(cartTotalCents * appliedCouponDiscountRate) : 0;
  const cartFinalTotalCents = Math.max(0, cartTotalCents - couponDiscountCents);
  const cartCashback = cashbackFor(cartFinalTotalCents);
  const pendingOrders = orders.filter((order) => order.status === "pending" && !isPendingPixExpired(order));

  function selectCategory(category: string) {
    setActiveCategory(category);
    setVisibleCount(productsPerPage);
  }

  function scrollToSection(targetId: string) {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authToken = hashParams.get("auth_token");
    const authUser = hashParams.get("auth_user");
    const authError = hashParams.get("auth_error");

    if (authToken && authUser) {
      localStorage.setItem("hellcifegeek.token", authToken);
      localStorage.setItem("hellcifegeek.user", authUser);
      const parsedUser = JSON.parse(authUser) as AuthUser;
      setCurrentUser(parsedUser);
      setAccountPhone(parsedUser.phone ?? "");
      setIsAccountPhoneEditing(false);
      setAuthMessage("Login Google realizado.");
      setAuthModal(null);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (authError) {
      setAuthMessage(`Login Google falhou: ${authError}`);
      setAuthModal("login");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    const storedUser = localStorage.getItem("hellcifegeek.user");

    if (!authToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setCurrentUser(parsedUser);
        setAccountPhone(parsedUser.phone ?? "");
        setIsAccountPhoneEditing(false);
      } catch {
        localStorage.removeItem("hellcifegeek.user");
        localStorage.removeItem("hellcifegeek.token");
      }
    }

    let isMounted = true;

    async function loadProducts() {
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          fetch(`${apiUrl}/products?active=true`, { cache: "no-store" }),
          fetch(`${apiUrl}/categories`, { cache: "no-store" })
        ]);

        if (!productsResponse.ok || !categoriesResponse.ok) {
          throw new Error("API indisponivel");
        }

        const [productsData, categoriesData] = await Promise.all([
          productsResponse.json() as Promise<ApiProduct[]>,
          categoriesResponse.json() as Promise<ApiCategory[]>
        ]);

        if (!isMounted) {
          return;
        }

        setProducts(productsData);
        setCategories(categoriesData);
        setProductsError("");
      } catch {
        if (isMounted) {
          setProducts([]);
          setProductsError("Nao foi possivel carregar os produtos agora.");
        }
      } finally {
        if (isMounted) {
          setIsProductsLoading(false);
        }
      }
    }

    void loadProducts();
    void refreshCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!accountMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAccountMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [accountMessage]);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem(cartStorageKey);

      if (storedCart) {
        const parsedCart = JSON.parse(storedCart) as CartItem[];
        setCartItems(Array.isArray(parsedCart) ? parsedCart : []);
      }
    } catch {
      setCartItems([]);
    } finally {
      setCartLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (cartLoaded) {
      localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
    }
  }, [cartItems, cartLoaded]);

  useEffect(() => {
    if (!cartLoaded || isProductsLoading || !currentUser) {
      return;
    }

    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetch(`${apiUrl}/payments/cart-activity`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cartActivityItems
        })
      }).catch(() => undefined);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [cartActivityItems, cartLoaded, currentUser?.id, isProductsLoading]);

  useEffect(() => {
    if (!currentUser) {
      setOrders([]);
      return;
    }

    void refreshOrders();
  }, [currentUser?.id]);

  useEffect(() => {
    try {
      const storedPayment = localStorage.getItem(pendingPixStorageKey);

      if (!storedPayment) {
        return;
      }

      const parsedPayment = JSON.parse(storedPayment) as PixPayment;

      if (parsedPayment?.status === "pending" && !isPendingPixExpired(parsedPayment)) {
        setPixPayment(parsedPayment);
      } else {
        localStorage.removeItem(pendingPixStorageKey);
      }
    } catch {
      localStorage.removeItem(pendingPixStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!pixPayment) {
      localStorage.removeItem(pendingPixStorageKey);
      return;
    }

    if (pixPayment.status === "pending" && !isPendingPixExpired(pixPayment)) {
      localStorage.setItem(pendingPixStorageKey, JSON.stringify(pixPayment));
      return;
    }

    localStorage.removeItem(pendingPixStorageKey);
  }, [pixPayment]);

  useEffect(() => {
    if (!pixPayment || pixPayment.status !== "pending") {
      return;
    }

    if (isPendingPixExpired(pixPayment)) {
      setPixPayment({ ...pixPayment, status: "expired" });
      setCartMessage("Pix expirado. Gere um novo pagamento.");
      return;
    }

    const intervalId = window.setInterval(async () => {
      const token = localStorage.getItem("hellcifegeek.token");

      if (!token) {
        return;
      }

      const response = await fetch(`${apiUrl}/payments/${pixPayment.id}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const payment = await response.json() as PixPayment;
      setPixPayment(payment);
      setOrders((currentOrders) => {
        const existing = currentOrders.some((order) => order.id === payment.id);
        return existing
          ? currentOrders.map((order) => order.id === payment.id ? payment : order)
          : [payment, ...currentOrders];
      });

      if (payment.status === "approved") {
        setCartItems([]);
        setCouponCode("");
        setAppliedCouponCode("");
        setAppliedCouponDiscountRate(0);
        setCouponMessage("");
        setCartMessage(`Pix aprovado. ${payment.cashback} hellpoints adicionados.`);
        void refreshCurrentUser();
        void refreshOrders();
      } else if (payment.status === "expired") {
        setCartMessage("Pix expirado. Gere um novo pagamento.");
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [pixPayment]);

  useEffect(() => {
    if (!pixPayment?.expiresAt || pixPayment.status !== "pending") {
      return;
    }

    const expiresInMs = new Date(pixPayment.expiresAt).getTime() - Date.now();

    if (expiresInMs <= 0) {
      setPixPayment({ ...pixPayment, status: "expired" });
      setCartMessage("Pix expirado. Gere um novo pagamento.");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPixPayment((currentPayment) => (
        currentPayment?.id === pixPayment.id && currentPayment.status === "pending"
          ? { ...currentPayment, status: "expired" }
          : currentPayment
      ));
      setCartMessage("Pix expirado. Gere um novo pagamento.");
    }, expiresInMs);

    return () => window.clearTimeout(timeoutId);
  }, [pixPayment]);

  useEffect(() => {
    if (!cartLoaded || isProductsLoading) {
      return;
    }

    setCartItems((currentItems) => currentItems.filter((item) => productsById.has(item.productId)));
  }, [cartLoaded, isProductsLoading, productsById]);

  useEffect(() => {
    if (!hasPhoneCoupon && appliedCouponCode === phoneCouponCode) {
      setAppliedCouponCode("");
      setCouponMessage("");
    }
  }, [appliedCouponCode, hasPhoneCoupon]);

  useEffect(() => {
    if (!cartMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCartMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [cartMessage]);

  function getAuthModalElement(modal = authModal) {
    if (modal === "login") {
      return loginModalRef.current;
    }

    if (modal === "signup") {
      return signupModalRef.current;
    }

    return null;
  }

  function animateAuthIn(modal: HTMLElement) {
    const panel = modal.querySelector(".authModal");

    if (!panel) {
      return;
    }

    gsap.killTweensOf([modal, panel]);
    gsap.set(modal, { display: "grid", autoAlpha: 0 });
    gsap.set(panel, { autoAlpha: 0, y: 26, scale: 0.96 });
    gsap.to(modal, { autoAlpha: 1, duration: 0.18, ease: "power2.out" });
    gsap.to(panel, { autoAlpha: 1, y: 0, scale: 1, duration: 0.38, ease: "power3.out" });
  }

  function animateAuthOut(modal: HTMLElement, onComplete?: () => void) {
    const panel = modal.querySelector(".authModal");

    if (!panel) {
      onComplete?.();
      return;
    }

    gsap.killTweensOf([modal, panel]);
    gsap.to(panel, { autoAlpha: 0, y: -14, scale: 0.98, duration: 0.18, ease: "power2.in" });
    gsap.to(modal, {
      autoAlpha: 0,
      duration: 0.22,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(modal, { clearProps: "display,opacity,visibility" });
        onComplete?.();
      }
    });
  }

  function openAuthModal(nextModal: "login" | "signup") {
    setAuthMessage("");

    if (!authModal || authModal === nextModal) {
      setAuthModal(nextModal);
      return;
    }

    const currentModal = getAuthModalElement();

    if (!currentModal) {
      setAuthModal(nextModal);
      return;
    }

    animateAuthOut(currentModal, () => setAuthModal(nextModal));
  }

  function closeAuthModal() {
    const currentModal = getAuthModalElement();

    if (!currentModal) {
      setAuthModal(null);
      return;
    }

    animateAuthOut(currentModal, () => {
      setAuthModal(null);
      setAuthMessage("");
    });
  }

  useEffect(() => {
    const currentModal = getAuthModalElement();

    if (currentModal) {
      animateAuthIn(currentModal);
    }
  }, [authModal]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAuthModal();
        setSelectedProduct(null);
        setCartOpen(false);
        setAccountOpen(false);
        setRaffleModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [authModal]);

  function openProduct(product: ApiProduct) {
    setSelectedProduct(product);
    setSelectedImageIndex(0);
    setProductQuantity(1);
    setCartMessage("");
  }

  function changeProductQuantity(nextQuantity: number) {
    if (!selectedProduct) {
      return;
    }

    const maxQuantity = Math.max(1, stockFor(selectedProduct));
    setProductQuantity(Math.min(maxQuantity, Math.max(1, nextQuantity)));
  }

  function quantityInCart(productId: string) {
    return cartItems.find((item) => item.productId === productId)?.quantity ?? 0;
  }

  function addToCart(product: ApiProduct, quantity = 1) {
    const stock = stockFor(product);

    if (!product.active || stock <= 0) {
      setCartMessage("Produto indisponivel.");
      return false;
    }

    setCartItems((currentItems) => {
      const existing = currentItems.find((item) => item.productId === product.id);
      const currentQuantity = existing?.quantity ?? 0;
      const nextQuantity = Math.min(stock, currentQuantity + quantity);

      if (existing) {
        return currentItems.map((item) => item.productId === product.id ? { ...item, quantity: nextQuantity } : item);
      }

      return [...currentItems, { productId: product.id, quantity: Math.max(1, nextQuantity) }];
    });

    setCartMessage("Produto adicionado ao carrinho.");
    return true;
  }

  function updateCartQuantity(productId: string, nextQuantity: number) {
    const product = productsById.get(productId);

    if (!product) {
      return;
    }

    const stock = stockFor(product);

    if (nextQuantity <= 0) {
      setCartItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
      return;
    }

    setCartItems((currentItems) => currentItems.map((item) => (
      item.productId === productId ? { ...item, quantity: Math.min(stock, nextQuantity) } : item
    )));
  }

  function removeFromCart(productId: string) {
    setCartItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
  }

  function setSession(user: AuthUser, token: string) {
    localStorage.setItem("hellcifegeek.token", token);
    localStorage.setItem("hellcifegeek.user", JSON.stringify(user));
    setCurrentUser(user);
    setAccountPhone(user.phone ?? "");
    setIsAccountPhoneEditing(false);
    setAuthModal(null);
  }

  useEffect(() => {
    if (!raffleMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRaffleMessage("");
    }, 3600);

    return () => window.clearTimeout(timeoutId);
  }, [raffleMessage]);

  function logout() {
    localStorage.removeItem("hellcifegeek.token");
    localStorage.removeItem("hellcifegeek.user");
    localStorage.removeItem(pendingPixStorageKey);
    setCurrentUser(null);
    setAccountOpen(false);
    setAccountPhone("");
    setIsAccountPhoneEditing(false);
    setAccountMessage("");
    setCouponCode("");
    setAppliedCouponCode("");
    setCouponMessage("");
    setOrders([]);
    setPixPayment(null);
  }

  async function refreshCurrentUser() {
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      return null;
    }

    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json() as AuthUser;
    localStorage.setItem("hellcifegeek.user", JSON.stringify(user));
    setCurrentUser(user);
    setAccountPhone(user.phone ?? "");
    setIsAccountPhoneEditing(false);
    return user;
  }

  async function refreshOrders() {
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      setOrders([]);
      return [];
    }

    const response = await fetch(`${apiUrl}/payments`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!response.ok) {
      return orders;
    }

    const data = await response.json() as PixPayment[];
    setOrders(data);
    const activePayment = data.find((payment) => payment.status === "pending" && !isPendingPixExpired(payment));
    setPixPayment((currentPayment) => currentPayment ?? activePayment ?? null);
    return data;
  }

  async function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCoupon = couponCode.trim().toUpperCase();

    if (!normalizedCoupon) {
      setAppliedCouponCode("");
      setAppliedCouponDiscountRate(0);
      setCouponMessage("Cupom invalido.");
      return;
    }

    if (normalizedCoupon === phoneCouponCode) {
      if (appliedCouponCode && appliedCouponCode !== phoneCouponCode) {
        setCouponMessage("Remova o cupom atual antes de usar outro.");
        return;
      }

      if (!hasPhoneCoupon) {
        setAppliedCouponCode("");
        setAppliedCouponDiscountRate(0);
        setCouponMessage("Adicione um celular na conta para liberar este cupom.");
        return;
      }

      setAppliedCouponCode(phoneCouponCode);
      setAppliedCouponDiscountRate(phoneCouponDiscountRate);
      setCouponCode(phoneCouponCode);
      setCouponMessage("");
      return;
    }

    if (appliedCouponCode && appliedCouponCode !== normalizedCoupon) {
      setCouponMessage("Remova o cupom atual antes de usar outro.");
      return;
    }

    const response = await fetch(`${apiUrl}/auth/coupons/${encodeURIComponent(normalizedCoupon)}`, { cache: "no-store" });

    if (!response.ok) {
      setAppliedCouponCode("");
      setAppliedCouponDiscountRate(0);
      setCouponMessage("Cupom invalido.");
      return;
    }

    const data = await response.json() as { code: string; discountPercent: number; partnerName?: string };
    setAppliedCouponCode(data.code);
    setAppliedCouponDiscountRate((data.discountPercent || 10) / 100);
    setCouponCode(data.code);
    setCouponMessage("");
  }

  async function updateAccountPhone(nextPhone: string) {
    setAccountMessage("");

    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      setAccountMessage("Faca login novamente.");
      return;
    }

    const response = await fetch(`${apiUrl}/auth/me`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ phone: nextPhone })
    });

    if (!response.ok) {
      setAccountMessage("Nao foi possivel salvar o celular.");
      return;
    }

    const user = await response.json() as AuthUser;
    localStorage.setItem("hellcifegeek.user", JSON.stringify(user));
    setCurrentUser(user);
    setAccountPhone(user.phone ?? "");
    setIsAccountPhoneEditing(false);
    setAccountMessage(user.phone ? `Celular salvo. Cupom ${phoneCouponCode} liberado.` : "Celular removido.");
  }

  async function saveAccountPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateAccountPhone(accountPhone);
  }

  async function removeAccountPhone() {
    await updateAccountPhone("");
  }

  function checkoutProduct(product: ApiProduct, quantity: number) {
    if (!product.active || stockFor(product) <= 0) {
      setCartMessage("Produto indisponivel.");
      return;
    }

    addToCart(product, quantity);
    setSelectedProduct(null);
    setCartOpen(true);
    setCartMessage("Item adicionado. Finalize com Pix para ganhar Hellpoints.");
  }

  async function checkoutPix() {
    if (cartLines.length === 0) {
      setCartMessage("Adicione um item ao carrinho antes de finalizar.");
      return;
    }

    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      setCartOpen(false);
      setCartMessage("Entre na conta para pagar com Pix.");
      openAuthModal("login");
      return;
    }

    setIsCreatingPix(true);
    setCartMessage("");
    setPixPayment(null);

    try {
      const response = await fetch(`${apiUrl}/payments/pix`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subtotalCents: cartTotalCents,
          totalCents: cartFinalTotalCents,
          couponCode: appliedCouponCode,
          items: cartLines.map((line) => ({
            productId: line.product.id,
            name: line.product.name,
            quantity: line.item.quantity,
            priceCents: line.product.priceCents
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null;
        setCartMessage(error?.message || "Não foi possível gerar o Pix.");
        return;
      }

      const payment = await response.json() as PixPayment;
      setPixPayment(payment);
      setOrders((currentOrders) => [payment, ...currentOrders.filter((order) => order.id !== payment.id)]);
      setCartItems([]);
      setCouponCode("");
      setAppliedCouponCode("");
      setAppliedCouponDiscountRate(0);
      setCouponMessage("");
      setCartOpen(false);
      setCartMessage(payment.reusedPending ? "Você já tem um Pix pendente para este produto." : "Pedido criado. Continue para o pagamento.");
      router.push(`/checkout/${payment.id}`);
    } finally {
      setIsCreatingPix(false);
    }
  }

  async function buyPromoRaffleTicket() {
    setRaffleMessage("");
    const token = localStorage.getItem("hellcifegeek.token");

    if (!token) {
      setRaffleModalOpen(false);
      openAuthModal("signup");
      setAuthMessage("Crie sua conta para ganhar Hellpoints e comprar tickets.");
      return;
    }

    setIsBuyingRaffleTicket(true);

    try {
      const response = await fetch(`${apiUrl}/auth/me/hellpoints/tickets`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Não foi possível comprar o ticket." })) as { message?: string };
        setRaffleMessage(error.message ?? "Não foi possível comprar o ticket.");
        return;
      }

      const user = await response.json() as AuthUser;
      localStorage.setItem("hellcifegeek.user", JSON.stringify(user));
      setCurrentUser(user);
      setRaffleMessage("Ticket comprado. Use ele no sorteio em Hellpoints.");
    } finally {
      setIsBuyingRaffleTicket(false);
    }
  }

  async function submitManualLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setAuthMessage("");

    let response: Response;

    try {
      response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
    } catch {
      setAuthMessage("Nao foi possivel conectar ao servidor.");
      return;
    }

    if (!response.ok) {
      setAuthMessage("Email ou senha invalidos.");
      return;
    }

    const data = await response.json() as { token: string; user: AuthUser };
    setSession(data.user, data.token);
    setAuthMessage("Login realizado.");

    if (data.user.role === "admin") {
      router.push("/admin");
    } else if (data.user.role === "partner") {
      router.push("/parceiro");
    }
  }

  async function submitManualSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setAuthMessage("");

    let response: Response;

    try {
      response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name") || "Cliente Hellcife",
          email: formData.get("email"),
          password: formData.get("password"),
          phone: formData.get("phone"),
          termsAccepted: formData.get("termsAccepted") === "on",
          marketingEmailsOptIn: formData.get("marketingEmailsOptIn") === "on"
        })
      });
    } catch {
      setAuthMessage("Nao foi possivel conectar ao servidor.");
      return;
    }

    if (!response.ok) {
      setAuthMessage("Aceite os termos e revise os dados do cadastro.");
      return;
    }

    const data = await response.json() as { token: string; user: AuthUser };
    setSession(data.user, data.token);
    setAuthMessage("Cadastro realizado.");
  }

  return (
    <main>
      <button type="button" className="logo" onClick={() => scrollToSection("top")}>HCG</button>
      <nav className="nav">
        <div className="navPill" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item.label} type="button" onClick={() => scrollToSection(item.targetId)}>{item.label}</button>
          ))}
          {currentUser ? (
            <button type="button" className="accountLink" onClick={() => setAccountOpen(true)} aria-label="Abrir conta">
              <UserRound size={16} strokeWidth={3} />
            </button>
          ) : (
            <button type="button" className="loginLink" onClick={() => openAuthModal("login")} aria-haspopup="dialog">
              Login
            </button>
          )}
          <button type="button" onClick={() => router.push("/hellpoints")}>Hellpoints</button>
          <button type="button" className="cartLink" onClick={() => setCartOpen(true)} aria-label={`Abrir carrinho com ${cartCount} itens`}>
            <ShoppingCart size={15} strokeWidth={3} />
            <span>{cartCount}</span>
          </button>
        </div>
      </nav>

      <section id="top" className="hero">
        <div className="heroCode" aria-label="Frete gratis e pronta entrega em Recife">
          <div className="heroCodeTrack">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index}>Frete gratis / pronta entrega a partir de R$50 em Recife</span>
            ))}
          </div>
        </div>
        <HeroHeadline />
        <div className="heroMeta">
          <div>
            <span>Based in</span>
            <strong>Recife, Brazil</strong>
          </div>
          <RotatingScrollIndicator onClick={() => scrollToSection("work")} />
          <div className="role">
            <span>Importados</span>
            <strong>DROPS DO JAPAO<br />FIGURES RARAS<br />MANGAS E BOTTONS<br />PRONTA ENTREGA</strong>
          </div>
        </div>
      </section>

      <section id="work" className="marketplacePortfolio">
        <div className="filterBar" aria-label="Marketplace filters">
          <div className="filterOptions">
            {filterOptions.map((category) => (
              <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => selectCategory(category)}>
                {category}
              </button>
            ))}
          </div>
          <strong>DROP POKEMONS</strong>
        </div>

        <div className="productGrid">
          {displayedProducts.map((product) => (
            <article
              key={product.id}
              className="productCard"
              role="button"
              tabIndex={0}
              onClick={() => openProduct(product)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openProduct(product);
                }
              }}
            >
              <div className="productImage">
                <img src={productImages(product)[0]} alt={product.name} />
                {product.recommended && <span>Recomendado</span>}
              </div>
              <div className="productBody">
                <div className="productMeta">
                  <span>{categoriesById.get(product.categoryId) ?? "Produto"}</span>
                  <strong>{formatPrice(product)}</strong>
                </div>
                <h3>{product.name}</h3>
                <div className="productTags">
                  {product.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <button type="button" className="productOpen" onClick={(event) => {
                  event.stopPropagation();
                  openProduct(product);
                }}>
                  <span>{stockLabel(product)}</span>
                  <ArrowUpRight size={28} strokeWidth={2.5} />
                </button>
              </div>
            </article>
          ))}
        </div>

        {isProductsLoading && (
          <div className="emptyProducts">
            <strong>Carregando produtos.</strong>
            <span>Buscando catalogo na API.</span>
          </div>
        )}

        {!isProductsLoading && displayedProducts.length === 0 && (
          <div className="emptyProducts">
            <strong>{productsError || "Nenhum produto cadastrado ainda."}</strong>
            <span>Quando voce criar produtos no admin, eles aparecem aqui automaticamente.</span>
          </div>
        )}

        {canShowMore && (
          <button className="loadMore" onClick={() => setVisibleCount((current) => current + productsPerPage)}>
            Ver mais
            <span>{visibleProducts.length - visibleCount} restantes</span>
          </button>
        )}
      </section>

      <section id="services" className="services isHidden">
        <div className="sectionHead">
          <span>Service list</span>
          <strong>04 operating layers</strong>
        </div>
        <div className="serviceList">
          {services.map((service) => (
            <article key={service.number} className="serviceCard">
              <span className="serviceNumber">{service.number}</span>
              <div className="serviceMain">
                <h2>{service.title}</h2>
                <div className="tags">
                  {service.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <ArrowUpRight className="serviceArrow" size={96} strokeWidth={1.7} />
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="cta">
        <p>Cadastre-se e participe</p>
        <h2>Cupons e Sorteios</h2>
        <div className="ctaActions">
          <button type="button" onClick={() => setRaffleModalOpen(true)}>Comprar ticket</button>
          <button type="button" className="secondary" onClick={() => openAuthModal("signup")}>Se cadastrar</button>
        </div>
      </section>

      <section className="marqueeSection footerRibbon">
        <div className="marqueeTrack">
          <div className="marqueeLine">
            <span>ACTION FIGURE • BOTTOM • FIGURINHAS • PULSEIRAS • ADESIVOS • COLARES • </span>
            <span>ACTION FIGURE • BOTTOM • FIGURINHAS • PULSEIRAS • ADESIVOS • COLARES • </span>
          </div>
          <div className="marqueeLine reverse">
            <span>IMPORTADOS DO JAPAO • DROPS RAROS • PRONTA ENTREGA • </span>
            <span>IMPORTADOS DO JAPAO • DROPS RAROS • PRONTA ENTREGA • </span>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>© 2026 Hellcife Geek</span>
        <div>
          <a href="https://www.instagram.com/hellcifegeek" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="/politicas">Políticas</a>
        </div>
      </footer>

      {selectedProduct && (
        <div className="productModalOverlay" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedProduct(null);
          }
        }}>
          <section className="productModal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <button type="button" className="closeModal productClose" onClick={() => setSelectedProduct(null)} aria-label="Fechar produto">
              <X size={22} strokeWidth={3} />
            </button>
            <div className="productModalMedia">
              <div className="productMainImage">
                <img src={productImages(selectedProduct)[selectedImageIndex] ?? selectedProduct.photoUrl} alt={selectedProduct.name} />
              </div>
              {productImages(selectedProduct).length > 1 && (
                <div className="productThumbs" aria-label="Galeria do produto">
                  {productImages(selectedProduct).map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={selectedImageIndex === index ? "active" : ""}
                      onClick={() => setSelectedImageIndex(index)}
                      aria-label={`Ver imagem ${index + 1}`}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="productModalInfo">
              <div className="productModalMeta">
                <span>{categoriesById.get(selectedProduct.categoryId) ?? "Produto"}</span>
                <strong>{formatPrice(selectedProduct)}</strong>
              </div>
              <h2 id="product-modal-title">{selectedProduct.name}</h2>
              {selectedProduct.description && <p>{selectedProduct.description}</p>}
              <div className="productTags">
                {selectedProduct.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="stockRow">
                <span>{stockLabel(selectedProduct)}</span>
                <strong>{quantityInCart(selectedProduct.id)} no carrinho</strong>
              </div>
              <div className="quantityControl" aria-label="Quantidade">
                <button type="button" onClick={() => changeProductQuantity(productQuantity - 1)} aria-label="Diminuir quantidade">
                  <Minus size={18} strokeWidth={3} />
                </button>
                <strong>{productQuantity}</strong>
                <button type="button" onClick={() => changeProductQuantity(productQuantity + 1)} aria-label="Aumentar quantidade">
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
              <div className="productModalActions">
                <button type="button" disabled={!selectedProduct.active || stockFor(selectedProduct) <= 0} onClick={() => checkoutProduct(selectedProduct, productQuantity)}>
                  Comprar agora
                </button>
                <button type="button" disabled={!selectedProduct.active || stockFor(selectedProduct) <= 0} onClick={() => addToCart(selectedProduct, productQuantity)}>
                  Colocar no carrinho
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {raffleModalOpen && (
        <div className="raffleModalOverlay" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setRaffleModalOpen(false);
          }
        }}>
          <section className="raffleModal" role="dialog" aria-modal="true" aria-labelledby="raffle-modal-title">
            <button type="button" className="closeModal raffleClose" onClick={() => setRaffleModalOpen(false)} aria-label="Fechar sorteio">
              <X size={22} strokeWidth={3} />
            </button>
            <div className="raffleModalBuy">
              <div className="raffleBadge">
                <Ticket size={58} strokeWidth={2.6} />
              </div>
              <span>Sorteio Hellpoints</span>
              <h2 id="raffle-modal-title">Ticket de sorteio</h2>
              <p>Compre tickets usando Hellpoints e coloque seu nome nos sorteios ativos da Hellcife Geek.</p>
              <div className="raffleWallet">
                <strong>{formatHellpoints(currentUser?.hellpoints)} HP</strong>
                <span>saldo atual</span>
                <strong>{formatHellpoints(currentUser?.raffleTickets)}x</strong>
                <span>tickets disponíveis</span>
              </div>
              <button type="button" onClick={buyPromoRaffleTicket} disabled={isBuyingRaffleTicket || Boolean(currentUser && Number(currentUser.hellpoints ?? 0) < 50)}>
                {isBuyingRaffleTicket ? "Comprando..." : "Comprar por 50 HP"}
              </button>
              {!currentUser && <button type="button" className="outline" onClick={() => { setRaffleModalOpen(false); openAuthModal("signup"); }}>Criar conta</button>}
              {raffleMessage && <p className="raffleNotice">{raffleMessage}</p>}
            </div>
            <div className="raffleModalInfo">
              <span>Como participar</span>
              <h3>Sorteio de lançamento</h3>
              <p>O sorteio especial libera quando a Hellcife Geek alcançar os primeiros 125 cadastros no site.</p>
              <ol>
                <li>Crie sua conta e ganhe Hellpoints iniciais.</li>
                <li>Compre um ticket usando 50 Hellpoints.</li>
                <li>Entre em Hellpoints e use o ticket no sorteio do controle 8BitDo original.</li>
                <li>Cada ticket usado coloca seu nome mais uma vez na lista do sorteio.</li>
              </ol>
              <button type="button" onClick={() => { setRaffleModalOpen(false); router.push("/hellpoints"); }}>
                Ir para Hellpoints
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="cartOverlay" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setCartOpen(false);
          }
        }}>
          <aside className="cartDrawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="cartHeader">
              <div>
                <span>Carrinho</span>
                <h2 id="cart-title">Seu pedido</h2>
              </div>
              <button type="button" className="closeModal" onClick={() => setCartOpen(false)} aria-label="Fechar carrinho">
                <X size={22} strokeWidth={3} />
              </button>
            </div>

            <div className="cartLines">
              {cartLines.length === 0 && (
                <div className="cartEmpty">
                  <strong>Carrinho vazio.</strong>
                  <span>Abra um produto e adicione ao pedido.</span>
                </div>
              )}

              {cartLines.map(({ item, product }) => (
                <article key={product.id} className="cartLine">
                  <img src={productImages(product)[0]} alt={product.name} />
                  <div>
                    <span>{categoriesById.get(product.categoryId) ?? "Produto"}</span>
                    <strong>{product.name}</strong>
                    <small>{formatCents(product.priceCents * item.quantity)}</small>
                    <div className="cartQty">
                      <button type="button" onClick={() => updateCartQuantity(product.id, item.quantity - 1)} aria-label="Diminuir item">
                        <Minus size={15} strokeWidth={3} />
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => updateCartQuantity(product.id, item.quantity + 1)} aria-label="Aumentar item">
                        <Plus size={15} strokeWidth={3} />
                      </button>
                      <button type="button" onClick={() => removeFromCart(product.id)} aria-label="Remover item">
                        <Trash2 size={15} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="cartFooter">
              {!appliedCouponCode && (
                <form className="cartCoupon" onSubmit={applyCoupon}>
                  <label>
                    Cupom
                    <input
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                      placeholder={hasPhoneCoupon ? phoneCouponCode : "Adicione celular na conta"}
                    />
                  </label>
                  <button type="submit" disabled={cartLines.length === 0}>Aplicar</button>
                </form>
              )}
              {appliedCouponCode && (
                <button
                  type="button"
                  className="cartCouponRemove"
                  onClick={() => {
                    setCouponCode("");
                    setAppliedCouponCode("");
                    setAppliedCouponDiscountRate(0);
                    setCouponMessage("");
                  }}
                >
                  Remover cupom {appliedCouponCode}
                </button>
              )}
              {couponMessage && !appliedCouponCode && <p className="cartMessage">{couponMessage}</p>}
              <div>
                <span>{couponDiscountCents > 0 ? `Total com ${appliedCouponCode}` : "Total"}</span>
                <strong className="cartTotalPrice">
                  {couponDiscountCents > 0 && <s>{formatCents(cartTotalCents)}</s>}
                  {formatCents(cartFinalTotalCents)}
                </strong>
              </div>
              <button type="button" disabled={cartLines.length === 0 || isCreatingPix} onClick={checkoutPix}>
                {isCreatingPix ? "Criando pedido..." : "Pagar com Pix"}
              </button>
              <button type="button" onClick={() => setCartOpen(false)}>
                Continuar comprando
              </button>
              {pendingOrders.length > 0 && (
                <button type="button" onClick={() => {
                  setCartOpen(false);
                  router.push("/pedidos");
                }}>
                  Ver pedidos pendentes
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {pendingOrders.length > 0 && !cartOpen && !accountOpen && (
        <button type="button" className="pendingPixTab" onClick={() => router.push("/pedidos")}>
          <Clock3 size={18} strokeWidth={3} />
          <span>Pedidos pendentes</span>
          <strong>{pendingOrders.length}</strong>
        </button>
      )}

      {accountOpen && currentUser && (
        <div className="cartOverlay" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setAccountOpen(false);
          }
        }}>
          <aside className="accountDrawer" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <div className="cartHeader">
              <div>
                <span>Conta</span>
                <h2 id="account-title">Perfil</h2>
              </div>
              <button type="button" className="closeModal" onClick={() => setAccountOpen(false)} aria-label="Fechar conta">
                <X size={22} strokeWidth={3} />
              </button>
            </div>

            <div className="accountContent">
              <div className="accountIdentity">
                <strong>{currentUser.name || currentUser.email}</strong>
                <span>{currentUser.email}</span>
              </div>

              {currentUser.phone && !isAccountPhoneEditing ? (
                <div className="accountForm accountPhoneSaved">
                  <span>Numero de celular</span>
                  <strong>{currentUser.phone}</strong>
                  <div className="accountPhoneActions">
                    <button type="button" onClick={() => {
                      setAccountPhone(currentUser.phone ?? "");
                      setIsAccountPhoneEditing(true);
                    }}>Editar</button>
                    <button type="button" className="secondary" onClick={removeAccountPhone}>Remover</button>
                  </div>
                </div>
              ) : (
                <form className="accountForm" onSubmit={saveAccountPhone}>
                  <label>
                    Numero de celular
                    <input
                      type="tel"
                      value={accountPhone}
                      onChange={(event) => setAccountPhone(event.target.value)}
                      placeholder="(81) 99999-9999"
                      autoComplete="tel"
                    />
                  </label>
                  <div className="accountPhoneActions">
                    <button type="submit">{currentUser.phone ? "Atualizar celular" : "Salvar celular"}</button>
                    {currentUser.phone && (
                      <button type="button" className="secondary" onClick={() => {
                        setAccountPhone(currentUser.phone ?? "");
                        setIsAccountPhoneEditing(false);
                      }}>Cancelar</button>
                    )}
                  </div>
                </form>
              )}

              <div className="accountPanel ordersShortcutPanel">
                <span>Meus pedidos</span>
                <strong>{pendingOrders.length > 0 ? `${pendingOrders.length} pagamento(s) pendente(s)` : "Acompanhar compras"}</strong>
                <button type="button" onClick={() => router.push("/pedidos")}>Ver pedidos</button>
              </div>

              <div className="accountPanel">
                <span>Cupons disponiveis</span>
                <strong>{currentUser.phone ? `${phoneCouponCode} - 5% OFF` : "Adicione celular para liberar 5% OFF"}</strong>
              </div>

              {currentUser.role === "partner" && (
                <div className="accountPanel partnerPanel">
                  <span>Parceiro</span>
                  <strong>{currentUser.partnerCouponCode ?? "Cupom em configuracao"}</strong>
                  <button type="button" onClick={() => router.push("/parceiro")}>Dashboard</button>
                </div>
              )}

              <div className="accountPanel">
                <span>Hellpoints</span>
                <strong>{formatHellpoints(currentUser.hellpoints)} pontos</strong>
              </div>

              <div className="accountPanel ticketPanel">
                <span>Tickets sorteio</span>
                <strong><Ticket size={24} strokeWidth={3} /> {formatHellpoints(currentUser.raffleTickets)}x tickets</strong>
                <button type="button" onClick={() => router.push("/hellpoints")}>Loja Hellpoints</button>
              </div>

              {accountMessage && <div className="accountToast" role="status">{accountMessage}</div>}
            </div>

            <div className="cartFooter">
              <button type="button" onClick={logout}>Sair da conta</button>
            </div>
          </aside>
        </div>
      )}

      <div
        id="login-modal"
        ref={loginModalRef}
        className={`modalOverlay ${authModal === "login" ? "isOpen" : ""}`}
        role="presentation"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeAuthModal();
          }
        }}
      >
        <section className="authModal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <div className="authHeader">
            <div>
              <span>Acesso</span>
              <h2 id="auth-title">Entrar na conta</h2>
            </div>
            <button type="button" className="closeModal" onClick={closeAuthModal} aria-label="Fechar modal">
              <X size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="authChoices">
            <button type="button" onClick={() => window.location.assign("/api/auth/google")}>
              <ChromeMark />
              <span>Entrar com Google</span>
            </button>
            <button type="button" disabled aria-disabled="true" title="Apple indisponivel temporariamente">
              <AppleMark />
              <span>Apple indisponivel</span>
            </button>
          </div>

          <form className="manualForm" onSubmit={submitManualLogin}>
            <label>
              Email
              <input type="email" name="email" placeholder="voce@email.com" autoComplete="email" required />
            </label>
            <label>
              Senha
              <span className="passwordField">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  name="password"
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showLoginPassword ? <EyeOff size={22} strokeWidth={2.6} /> : <Eye size={22} strokeWidth={2.6} />}
                </button>
              </span>
            </label>
            <div className="authActions">
              <button type="submit">Entrar</button>
              <button type="button" onClick={() => openAuthModal("signup")}>Cadastrar</button>
            </div>
            {authMessage && <p className="authMessage">{authMessage}</p>}
          </form>
        </section>
      </div>

      <div
        id="signup-modal"
        ref={signupModalRef}
        className={`modalOverlay ${authModal === "signup" ? "isOpen" : ""}`}
        role="presentation"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            closeAuthModal();
          }
        }}
      >
        <section className="authModal" role="dialog" aria-modal="true" aria-labelledby="signup-title">
          <div className="authHeader">
            <div>
              <span>Cadastro</span>
              <h2 id="signup-title">Criar conta</h2>
            </div>
            <button type="button" className="closeModal" onClick={closeAuthModal} aria-label="Fechar modal">
              <X size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="authChoices">
            <button type="button" onClick={() => window.location.assign("/api/auth/google")}>
              <ChromeMark />
              <span>Cadastrar com Google</span>
            </button>
            <button type="button" disabled aria-disabled="true" title="Apple indisponivel temporariamente">
              <AppleMark />
              <span>Apple indisponivel</span>
            </button>
          </div>

          <form className="manualForm" onSubmit={submitManualSignup}>
            <label>
              Nome
              <input type="text" name="name" placeholder="Seu nome" autoComplete="name" required />
            </label>
            <label>
              Email
              <input type="email" name="email" placeholder="voce@email.com" autoComplete="email" required />
            </label>
            <label>
              Senha
              <span className="passwordField">
                <input
                  type={showSignupPassword ? "text" : "password"}
                  name="password"
                  placeholder="Minimo 8 caracteres"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((current) => !current)}
                  aria-label={showSignupPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showSignupPassword ? <EyeOff size={22} strokeWidth={2.6} /> : <Eye size={22} strokeWidth={2.6} />}
                </button>
              </span>
            </label>
            <label>
              Numero de celular <span>Opcional</span>
              <input type="tel" name="phone" placeholder="(81) 99999-9999" autoComplete="tel" />
            </label>
            <label className="authCheck">
              <input type="checkbox" name="termsAccepted" required />
              <span>Li e aceito as <a href="/politicas" target="_blank" rel="noopener noreferrer">políticas de compra, privacidade, sorteios e parceria</a>.</span>
            </label>
            <label className="authCheck">
              <input type="checkbox" name="marketingEmailsOptIn" />
              <span>Quero receber e-mails promocionais, eventos, drops e comunicados atípicos da Hellcife Geek.</span>
            </label>
            <div className="authActions">
              <button type="button" onClick={() => openAuthModal("login")}>Voltar</button>
              <button type="submit">Cadastrar</button>
            </div>
            {authMessage && <p className="authMessage">{authMessage}</p>}
          </form>
        </section>
      </div>
      {cartMessage && <p className="cartToast">{cartMessage}</p>}
    </main>
  );
}
