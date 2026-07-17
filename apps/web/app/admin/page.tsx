"use client";

import type { ChangeEvent, ClipboardEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";
const adminSections = ["dashboard", "produtos", "categorias", "sorteios", "vendas", "carrinhos", "usuarios", "catalogo"] as const;

type AdminSection = typeof adminSections[number];

type AdminPageProps = {
  section?: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
};

type AdminProduct = {
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
  variations?: ProductVariation[];
};

type ProductVariation = {
  id?: string;
  name: string;
  priceCents?: number;
  stock?: number;
  photoUrl?: string;
};

type StoredUser = {
  role?: string;
};

type AdminUser = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role: "admin" | "client" | "partner";
  hellpoints?: number;
  raffleTickets?: number;
  banned?: boolean;
  partnerCouponCode?: string;
  partnerDiscountPercent?: number;
  partnerSince?: string;
  createdAt: string;
};

type LaunchRaffleParticipant = {
  userId: string;
  name: string;
  email: string;
  ticketCount: number;
  updatedAt: string;
};

type AdminLaunchRaffle = {
  id: string;
  title: string;
  prize: string;
  goal: number;
  registeredCount: number;
  totalTickets: number;
  userTickets: number;
  unlocked: boolean;
  participants: LaunchRaffleParticipant[];
};

type SalesReportItem = {
  productId?: string;
  name: string;
  quantity: number;
  priceCents: number;
};

type SalesReport = {
  summary: {
    saleCount: number;
    itemCount: number;
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    cashback: number;
    averageTicketCents: number;
    activeReservationCount: number;
    reservedItemCount: number;
  };
  productBreakdown: Array<{
    productId?: string;
    name: string;
    quantity: number;
    totalCents: number;
  }>;
  sales: Array<{
    id: string;
    paymentId: string;
    userId: string;
    userEmail: string;
    couponCode?: string;
    totalCents: number;
    discountCents: number;
    items: SalesReportItem[];
    approvedAt: string;
  }>;
  reservations: Array<{
    id: string;
    paymentId: string;
    userEmail: string;
    items: SalesReportItem[];
    expiresAt: string;
    createdAt: string;
  }>;
};

type AdminCartActivity = {
  userId: string;
  userEmail: string;
  userName?: string;
  items: SalesReportItem[];
  subtotalCents: number;
  updatedAt: string;
  remindAfter: string;
  reminderSentAt?: string;
};

type UserFilter = "recentes" | "antigos" | "compradores" | "carrinho" | "cadastro";

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  variations: ProductVariationForm[];
  photoUrls: string[];
  tags: string;
  categoryId: string;
  active: boolean;
  recommended: boolean;
};

type ProductVariationForm = {
  id?: string;
  name: string;
  price: string;
  stock: string;
  photoUrl: string;
};

const emptyProductForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  stock: "0",
  variations: [],
  photoUrls: [],
  tags: "",
  categoryId: "",
  active: true,
  recommended: false
};

function formatPrice(product: AdminProduct) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: product.currency
  }).format(product.priceCents / 100);
}

function priceToInput(product: AdminProduct) {
  return String(product.priceCents / 100).replace(".", ",");
}

function centsToInput(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  return String(value / 100).replace(".", ",");
}

function normalizePrice(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function tagsToText(tags: string[]) {
  return tags.join(", ");
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(Number(value ?? 0))));
}

function formatCents(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Math.max(0, Math.floor(Number(value ?? 0))) / 100);
}

function variationSummary(product: AdminProduct) {
  const variations = product.variations ?? [];

  if (variations.length === 0) {
    return "";
  }

  return variations.map((variation) => variation.name).join(", ");
}

function normalizeAdminSection(section?: string): AdminSection {
  return adminSections.includes(section as AdminSection) ? section as AdminSection : "dashboard";
}

export default function AdminPage({ section }: AdminPageProps) {
  const router = useRouter();
  const currentSection = normalizeAdminSection(section);
  const [email, setEmail] = useState("admin@hellcifegeek.com.br");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [launchRaffle, setLaunchRaffle] = useState<AdminLaunchRaffle | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [cartActivities, setCartActivities] = useState<AdminCartActivity[]>([]);
  const [userFilter, setUserFilter] = useState<UserFilter>("recentes");
  const [catalogTagFilter, setCatalogTagFilter] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const activeProducts = products.filter((product) => product.active).length;
  const recommendedProducts = products.filter((product) => product.recommended).length;
  const totalStock = products.reduce((total, product) => total + product.stock, 0);
  const clientUsers = users.filter((user) => user.role === "client");
  const partnerUsers = users.filter((user) => user.role === "partner");
  const partnerCouponCodes = new Set(partnerUsers
    .map((user) => user.partnerCouponCode?.toUpperCase())
    .filter((couponCode): couponCode is string => Boolean(couponCode)));
  const partnerSales = (salesReport?.sales ?? []).filter((sale) => (
    Boolean(sale.couponCode) && partnerCouponCodes.has(sale.couponCode!.toUpperCase())
  ));
  const partnerSalesTotalCents = partnerSales.reduce((total, sale) => total + sale.totalCents, 0);
  const launchRaffleProgress = Math.min(100, Math.round(((launchRaffle?.registeredCount ?? 0) / (launchRaffle?.goal || 125)) * 100));
  const catalogTags = useMemo(() => Array.from(new Set(products.flatMap((product) => product.tags)))
    .sort((first, second) => first.localeCompare(second, "pt-BR")), [products]);
  const visibleCatalogProducts = useMemo(() => {
    const filteredProducts = catalogTagFilter ? products.filter((product) => product.tags.includes(catalogTagFilter)) : products;

    return [...filteredProducts].sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended)));
  }, [catalogTagFilter, products]);
  const visibleUsers = useMemo(() => {
    const buyerIds = new Set((salesReport?.sales ?? []).map((sale) => sale.userId));
    const cartUserIds = new Set(cartActivities.map((cart) => cart.userId));
    let filteredUsers = [...users];

    if (userFilter === "compradores") {
      filteredUsers = filteredUsers.filter((user) => buyerIds.has(user.id));
    } else if (userFilter === "carrinho") {
      filteredUsers = filteredUsers.filter((user) => cartUserIds.has(user.id));
    } else if (userFilter === "cadastro") {
      filteredUsers = filteredUsers.filter((user) => user.role === "client" && !buyerIds.has(user.id) && !cartUserIds.has(user.id));
    }

    return filteredUsers.sort((first, second) => {
      const difference = new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      return userFilter === "antigos" ? -difference : difference;
    });
  }, [cartActivities, salesReport?.sales, userFilter, users]);

  function authHeaders(authToken = token) {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${authToken}`
    };
  }

  function clearAdminSession(messageText = "Sessao expirada. Entre novamente no admin.") {
    localStorage.removeItem("hellcifegeek.token");
    localStorage.removeItem("hellcifegeek.user");
    setToken("");
    setProducts([]);
    setCategories([]);
    setUsers([]);
    setLaunchRaffle(null);
    setSalesReport(null);
    setCartActivities([]);
    setMessage(messageText);
  }

  function handleAuthFailure(response: Response) {
    if (response.status !== 401 && response.status !== 403) {
      return false;
    }

    clearAdminSession();
    return true;
  }

  async function loadProducts() {
    const response = await fetch(`${apiUrl}/products`, { cache: "no-store" });
    const data = (await response.json()) as AdminProduct[];
    setProducts(data);
    return data;
  }

  async function loadCategories() {
    const response = await fetch(`${apiUrl}/categories`, { cache: "no-store" });
    const data = (await response.json()) as Category[];
    setCategories(data);
    setProductForm((current) => ({
      ...current,
      categoryId: current.categoryId || data[0]?.id || ""
    }));
  }

  async function loadUsers(authToken = token) {
    if (!authToken) {
      return;
    }

    const response = await fetch(`${apiUrl}/auth/admin/users`, {
      headers: authHeaders(authToken),
      cache: "no-store"
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel carregar os usuarios.");
      return;
    }

    const data = (await response.json()) as AdminUser[];
    setUsers(data);
  }

  async function loadLaunchRaffle(authToken = token) {
    if (!authToken) {
      return;
    }

    const response = await fetch(`${apiUrl}/auth/admin/raffles/launch`, {
      headers: authHeaders(authToken),
      cache: "no-store"
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Não foi possível carregar o sorteio.");
      return;
    }

    setLaunchRaffle(await response.json() as AdminLaunchRaffle);
  }

  async function loadSalesReport(authToken = token) {
    if (!authToken) {
      return;
    }

    const response = await fetch(`${apiUrl}/payments/admin/sales-report`, {
      headers: authHeaders(authToken),
      cache: "no-store"
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Não foi possível carregar o relatório de vendas.");
      return;
    }

    setSalesReport(await response.json() as SalesReport);
  }

  async function loadCartActivities(authToken = token) {
    if (!authToken) {
      return;
    }

    const response = await fetch(`${apiUrl}/payments/admin/cart-activity`, {
      headers: authHeaders(authToken),
      cache: "no-store"
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Não foi possível carregar os carrinhos.");
      return;
    }

    setCartActivities(await response.json() as AdminCartActivity[]);
  }

  async function loadAdminData(authToken = token) {
    await Promise.all([loadProducts(), loadCategories(), loadUsers(authToken), loadLaunchRaffle(authToken), loadSalesReport(authToken), loadCartActivities(authToken)]);
  }

  useEffect(() => {
    const storedToken = localStorage.getItem("hellcifegeek.token");
    const storedUser = localStorage.getItem("hellcifegeek.user");
    const user = storedUser ? JSON.parse(storedUser) as StoredUser : null;

    if (!storedToken || user?.role !== "admin") {
      return;
    }

    setToken(storedToken);
    void loadAdminData(storedToken);
  }, []);

  useEffect(() => {
    if (currentSection !== "produtos") {
      return;
    }

    const draft = sessionStorage.getItem("hellcifegeek.editProduct");

    if (!draft) {
      return;
    }

    try {
      setProductForm(JSON.parse(draft) as ProductForm);
    } catch {
      sessionStorage.removeItem("hellcifegeek.editProduct");
    }
  }, [currentSection]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/auth/admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setMessage("Login admin invalido.");
        return;
      }

      const data = (await response.json()) as { token: string; user: StoredUser };
      localStorage.setItem("hellcifegeek.token", data.token);
      localStorage.setItem("hellcifegeek.user", JSON.stringify(data.user));
      setToken(data.token);
      await loadAdminData(data.token);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    clearAdminSession("Sessao encerrada.");
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch(`${apiUrl}/categories`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: categoryName,
        description: categoryDescription
      })
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel criar a categoria.");
      return;
    }

    setCategoryName("");
    setCategoryDescription("");
    setMessage("Categoria criada.");
    await loadCategories();
  }

  async function removeCategory(category: Category) {
    const response = await fetch(`${apiUrl}/categories/${category.id}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Categoria possui produto vinculado ou nao pode ser removida.");
      return;
    }

    setMessage("Categoria removida.");
    await loadCategories();
  }

  async function uploadFiles(files: File[], successMessage = "Imagem enviada.") {
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setMessage("");

    try {
      const uploadedUrls: string[] = [];

      for (const [index, file] of files.entries()) {
        const fileName = file.name || `imagem-colada-${Date.now()}-${index + 1}.png`;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Falha ao ler imagem"));
          reader.readAsDataURL(file);
        });

        const response = await fetch(`${apiUrl}/uploads/product-image`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            fileName,
            contentType: file.type,
            base64
          })
        });

        if (!response.ok) {
          if (handleAuthFailure(response)) {
            return;
          }

          const error = await response.json().catch(() => ({ message: "Erro desconhecido" })) as { message?: string };
          throw new Error(`${fileName}: ${error.message ?? "nao foi possivel enviar"}`);
        }

        const data = (await response.json()) as { publicUrl: string };
        uploadedUrls.push(data.publicUrl);
      }

      setProductForm((current) => ({ ...current, photoUrls: Array.from(new Set([...current.photoUrls, ...uploadedUrls])) }));
      setMessage(uploadedUrls.length > 1 ? "Imagens enviadas." : successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar uma ou mais imagens.");
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));

    try {
      await uploadFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  async function pasteImages(event: ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));

    if (files.length === 0) {
      setMessage("Nenhuma imagem encontrada no clipboard.");
      return;
    }

    event.preventDefault();
    await uploadFiles(files, "Imagem colada e enviada.");
  }

  function editProduct(product: AdminProduct) {
    const nextForm = {
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      price: priceToInput(product),
      stock: String(product.stock ?? 0),
      variations: (product.variations ?? []).map((variation) => ({
        id: variation.id,
        name: variation.name,
        price: centsToInput(variation.priceCents),
        stock: variation.stock === undefined ? "" : String(variation.stock),
        photoUrl: variation.photoUrl ?? ""
      })),
      photoUrls: product.photoUrls?.length ? product.photoUrls : [product.photoUrl].filter(Boolean),
      tags: tagsToText(product.tags),
      categoryId: product.categoryId,
      active: product.active,
      recommended: Boolean(product.recommended)
    };

    setProductForm(nextForm);
    sessionStorage.setItem("hellcifegeek.editProduct", JSON.stringify(nextForm));
    router.push("/admin/produtos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    sessionStorage.removeItem("hellcifegeek.editProduct");
    setProductForm({
      ...emptyProductForm,
      categoryId: categories[0]?.id ?? ""
    });
  }

  function addProductVariation() {
    setProductForm((current) => ({
      ...current,
      variations: [...current.variations, { name: "", price: "", stock: "", photoUrl: "" }]
    }));
  }

  function updateProductVariation(index: number, field: keyof ProductVariationForm, value: string) {
    setProductForm((current) => ({
      ...current,
      variations: current.variations.map((variation, variationIndex) => (
        variationIndex === index ? { ...variation, [field]: value } : variation
      ))
    }));
  }

  function removeProductVariation(index: number) {
    setProductForm((current) => ({
      ...current,
      variations: current.variations.filter((_, variationIndex) => variationIndex !== index)
    }));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!productForm.categoryId) {
      setMessage("Crie ou selecione uma categoria antes de salvar.");
      return;
    }

    if (productForm.photoUrls.length === 0) {
      setMessage("Adicione pelo menos uma imagem do produto.");
      return;
    }

    const payload = {
      name: productForm.name,
      description: productForm.description,
      price: normalizePrice(productForm.price),
      stock: Number(productForm.stock),
      variations: productForm.variations
        .map((variation) => ({
          id: variation.id,
          name: variation.name.trim(),
          price: variation.price.trim() ? normalizePrice(variation.price) : undefined,
          stock: variation.stock.trim() ? Number(variation.stock) : undefined,
          photoUrl: variation.photoUrl.trim() || undefined
        }))
        .filter((variation) => variation.name),
      photoUrl: productForm.photoUrls[0],
      photoUrls: productForm.photoUrls,
      tags: productForm.tags,
      categoryId: productForm.categoryId,
      active: productForm.active,
      recommended: productForm.recommended
    };
    const endpoint = productForm.id ? `${apiUrl}/products/${productForm.id}` : `${apiUrl}/products`;
    const response = await fetch(endpoint, {
      method: productForm.id ? "PATCH" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel salvar o produto.");
      return;
    }

    const savedProduct = await response.json() as AdminProduct;
    setProducts((currentProducts) => {
      const exists = currentProducts.some((product) => product.id === savedProduct.id);
      return exists
        ? currentProducts.map((product) => product.id === savedProduct.id ? savedProduct : product)
        : [savedProduct, ...currentProducts];
    });
    setMessage(productForm.id ? "Produto atualizado." : "Produto criado e publicado no catalogo.");
    sessionStorage.removeItem("hellcifegeek.editProduct");
    resetProductForm();
    const nextProducts = await loadProducts();

    if (!nextProducts.some((product) => product.id === savedProduct.id)) {
      setProducts((currentProducts) => [savedProduct, ...currentProducts.filter((product) => product.id !== savedProduct.id)]);
      setMessage("Produto criado, mas a listagem ainda nao sincronizou. Clique em Atualizar no catalogo em alguns segundos.");
    }

    if (!productForm.id) {
      router.push("/admin/catalogo");
    }
  }

  async function toggleRecommended(product: AdminProduct) {
    const response = await fetch(`${apiUrl}/products/${product.id}/recommended`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ recommended: !product.recommended })
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel atualizar o produto.");
      return;
    }

    setMessage(product.recommended ? "Produto saiu dos recomendados." : "Produto marcado como recomendado.");
    await loadProducts();
  }

  async function removeProduct(product: AdminProduct) {
    const response = await fetch(`${apiUrl}/products/${product.id}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel remover o produto.");
      return;
    }

    setMessage("Produto removido.");
    await loadProducts();
  }

  async function toggleUserBan(user: AdminUser) {
    if (user.role === "admin") {
      setMessage("Nao e permitido banir conta admin.");
      return;
    }

    const response = await fetch(`${apiUrl}/auth/admin/users/${user.id}/ban`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ banned: !user.banned })
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel atualizar o usuario.");
      return;
    }

    setMessage(user.banned ? "Usuario desbanido." : "Usuario banido.");
    await loadUsers();
  }

  async function toggleUserPartner(user: AdminUser) {
    if (user.role === "admin") {
      setMessage("Nao e permitido alterar conta admin.");
      return;
    }

    const response = await fetch(`${apiUrl}/auth/admin/users/${user.id}/partner`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ partner: user.role !== "partner" })
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel atualizar o parceiro.");
      return;
    }

    const updatedUser = await response.json() as AdminUser;
    setMessage(updatedUser.role === "partner" ? `Parceiro ativado. Cupom ${updatedUser.partnerCouponCode}.` : "Parceiro removido.");
    await loadUsers();
  }

  async function updatePartnerCoupon(user: AdminUser) {
    if (user.role !== "partner") {
      setMessage("Transforme o usuario em parceiro antes de editar o cupom.");
      return;
    }

    const nextCoupon = window.prompt("Novo codigo do cupom", user.partnerCouponCode ?? "");

    if (nextCoupon === null) {
      return;
    }

    const response = await fetch(`${apiUrl}/auth/admin/users/${user.id}/partner`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ partner: true, couponCode: nextCoupon })
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      const error = await response.json().catch(() => ({ message: "Nao foi possivel atualizar o cupom." })) as { message?: string };
      setMessage(error.message ?? "Nao foi possivel atualizar o cupom.");
      return;
    }

    const updatedUser = await response.json() as AdminUser;
    setMessage(`Cupom atualizado para ${updatedUser.partnerCouponCode}.`);
    await loadUsers();
  }

  async function deleteUser(user: AdminUser) {
    if (user.role === "admin") {
      setMessage("Nao e permitido deletar conta admin.");
      return;
    }

    const confirmed = window.confirm(`Deletar o cadastro de ${user.email}? Esta acao nao pode ser desfeita.`);

    if (!confirmed) {
      return;
    }

    const response = await fetch(`${apiUrl}/auth/admin/users/${user.id}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    if (!response.ok) {
      if (handleAuthFailure(response)) {
        return;
      }

      setMessage("Nao foi possivel deletar o usuario.");
      return;
    }

    setMessage("Usuario deletado.");
    await loadUsers();
  }

  if (!token) {
    return (
      <main className="adminShell">
        <section className="adminLoginCard">
          <a className="adminBrand" href="/">Hellcife Geek</a>
          <h1>Entrar no admin</h1>
          <p>Acesse o painel para gerenciar produtos, categorias, imagens e recomendados.</p>
          <form className="adminCleanForm" onSubmit={login}>
            <label>
              Email admin
              <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
            <label>
              Senha
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
            <button type="submit" disabled={isLoading}>{isLoading ? "Entrando..." : "Entrar"}</button>
          </form>
          {message && <p className="adminNotice">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <aside className="adminSidebar">
        <a className="adminBrand" href="/">Hellcife Geek</a>
        <nav>
          <a className={currentSection === "dashboard" ? "active" : ""} href="/admin">Dashboard</a>
          <a className={currentSection === "produtos" ? "active" : ""} href="/admin/produtos">Produtos</a>
          <a className={currentSection === "categorias" ? "active" : ""} href="/admin/categorias">Categorias</a>
          <a className={currentSection === "sorteios" ? "active" : ""} href="/admin/sorteios">Sorteios</a>
          <a className={currentSection === "vendas" ? "active" : ""} href="/admin/vendas">Vendas</a>
          <a className={currentSection === "carrinhos" ? "active" : ""} href="/admin/carrinhos">Carrinhos</a>
          <a className={currentSection === "usuarios" ? "active" : ""} href="/admin/usuarios">Usuarios</a>
          <a className={currentSection === "catalogo" ? "active" : ""} href="/admin/catalogo">Catalogo</a>
        </nav>
        <button type="button" onClick={logout}>Sair</button>
      </aside>

      <section className="adminWorkspace">
        {message && <p className="adminNotice">{message}</p>}

        {currentSection === "dashboard" && (
          <section className="adminDashboard" aria-label="Visão geral do negócio">
            <div className="adminDashboardHeader">
              <div>
                <span>Visão geral</span>
                <h1>Dashboard</h1>
              </div>
              <button type="button" onClick={() => loadAdminData()}>Atualizar dados</button>
            </div>

            <div className="adminDashboardGrid">
              <article className="adminDashboardPanel">
                <div className="adminDashboardPanelHeader">
                  <div>
                    <span>Vendas</span>
                    <h2>Resumo comercial</h2>
                  </div>
                  <a href="/admin/vendas">Ver vendas</a>
                </div>
                <div className="adminDashboardMetrics">
                  <div><span>Total vendido</span><strong>{formatCents(salesReport?.summary.totalCents)}</strong></div>
                  <div><span>Vendas concluídas</span><strong>{formatNumber(salesReport?.summary.saleCount)}</strong></div>
                  <div><span>Ticket médio</span><strong>{formatCents(salesReport?.summary.averageTicketCents)}</strong></div>
                  <div><span>Carrinhos ativos</span><strong>{formatNumber(cartActivities.length)}</strong></div>
                </div>
              </article>

              <article className="adminDashboardPanel">
                <div className="adminDashboardPanelHeader">
                  <div>
                    <span>Parceiros</span>
                    <h2>Cupons e indicações</h2>
                  </div>
                  <a href="/admin/usuarios">Ver parceiros</a>
                </div>
                <div className="adminDashboardMetrics">
                  <div><span>Parceiros ativos</span><strong>{formatNumber(partnerUsers.length)}</strong></div>
                  <div><span>Vendas com cupom</span><strong>{formatNumber(partnerSales.length)}</strong></div>
                  <div><span>Valor indicado</span><strong>{formatCents(partnerSalesTotalCents)}</strong></div>
                  <div><span>Clientes</span><strong>{formatNumber(clientUsers.length)}</strong></div>
                </div>
              </article>

              <article className="adminDashboardPanel">
                <div className="adminDashboardPanelHeader">
                  <div>
                    <span>Hellpoints</span>
                    <h2>Sorteio de lançamento</h2>
                  </div>
                  <a href="/admin/sorteios">Ver sorteio</a>
                </div>
                <div className="adminDashboardMetrics">
                  <div><span>Tickets distribuídos</span><strong>{formatNumber(launchRaffle?.totalTickets)}</strong></div>
                  <div><span>Participantes</span><strong>{formatNumber(launchRaffle?.registeredCount)} / {formatNumber(launchRaffle?.goal ?? 125)}</strong></div>
                  <div><span>Status</span><strong>{launchRaffle?.unlocked ? "Liberado" : "Aguardando meta"}</strong></div>
                </div>
                <div className="adminRaffleProgress" aria-label={`${launchRaffleProgress}% da meta`}>
                  <span style={{ width: `${launchRaffleProgress}%` }} />
                </div>
              </article>

              <article className="adminDashboardPanel">
                <div className="adminDashboardPanelHeader">
                  <div>
                    <span>Catálogo</span>
                    <h2>Disponibilidade</h2>
                  </div>
                  <a href="/admin/catalogo">Ver catálogo</a>
                </div>
                <div className="adminDashboardMetrics">
                  <div><span>Produtos</span><strong>{formatNumber(products.length)}</strong></div>
                  <div><span>Ativos</span><strong>{formatNumber(activeProducts)}</strong></div>
                  <div><span>Em estoque</span><strong>{formatNumber(totalStock)}</strong></div>
                  <div><span>Recomendados</span><strong>{formatNumber(recommendedProducts)}</strong></div>
                </div>
              </article>
            </div>
          </section>
        )}

        {(currentSection === "produtos" || currentSection === "categorias") && (
        <div className="adminGrid">
          {currentSection === "produtos" && (
          <section id="produtos" className="adminCard">
            <div className="adminCardHeader">
              <div>
                <span>{productForm.id ? "Editar produto" : "Novo produto"}</span>
                <h2>{productForm.id ? productForm.name : "Cadastrar produto"}</h2>
              </div>
              {productForm.id && <button type="button" onClick={resetProductForm}>Novo</button>}
            </div>

            <form className="adminCleanForm productEditor" onSubmit={saveProduct}>
              <label>
                Nome
                <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label>
                Categoria
                <select value={productForm.categoryId} onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))} required>
                  <option value="" disabled>Selecione</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Preco
                <input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} placeholder="129,90" inputMode="decimal" required />
              </label>
              <label>
                Estoque
                <input value={productForm.stock} onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))} placeholder="0" inputMode="numeric" min="0" type="number" required />
              </label>
              <div className="variationEditor full">
                <div className="variationEditorHead">
                  <div>
                    <span>Variacoes</span>
                    <strong>Tamanho, cor, modelo ou outra opcao</strong>
                  </div>
                  <button type="button" onClick={addProductVariation}>Adicionar variacao</button>
                </div>
                {productForm.variations.length > 0 && (
                  <div className="variationRows">
                    {productForm.variations.map((variation, index) => (
                      <div className="variationRow" key={variation.id ?? index}>
                        <label>
                          Nome
                          <input value={variation.name} onChange={(event) => updateProductVariation(index, "name", event.target.value)} placeholder="Ex: Versao A, P, Azul" />
                        </label>
                        <label>
                          Preco opcional
                          <input value={variation.price} onChange={(event) => updateProductVariation(index, "price", event.target.value)} placeholder="164,99" inputMode="decimal" />
                        </label>
                        <label>
                          Estoque opcional
                          <input value={variation.stock} onChange={(event) => updateProductVariation(index, "stock", event.target.value)} placeholder="0" inputMode="numeric" min="0" type="number" />
                        </label>
                        <label>
                          Foto opcional
                          <select value={variation.photoUrl} onChange={(event) => updateProductVariation(index, "photoUrl", event.target.value)}>
                            <option value="">Usar foto principal</option>
                            {productForm.photoUrls.map((url, photoIndex) => (
                              <option key={url} value={url}>Foto {photoIndex + 1}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="danger" onClick={() => removeProductVariation(index)}>Remover</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label>
                Tags
                <input value={productForm.tags} onChange={(event) => setProductForm((current) => ({ ...current, tags: event.target.value }))} placeholder="action figure, japao, raro" />
              </label>
              <label className="full">
                Descricao
                <textarea value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} rows={4} />
              </label>
              <label className="full">
                URLs das fotos
                <textarea
                  value={productForm.photoUrls.join("\n")}
                  onChange={(event) => setProductForm((current) => ({ ...current, photoUrls: event.target.value.split("\n").map((url) => url.trim()).filter(Boolean) }))}
                  placeholder="Uma URL por linha"
                  rows={4}
                  required
                />
              </label>
              <label>
                Upload das fotos
                <input type="file" accept="image/avif,image/webp,image/png,image/jpeg,image/*" onChange={uploadImage} disabled={isUploading} multiple />
              </label>
              <div
                className="pasteImageBox"
                onPaste={pasteImages}
                role="button"
                tabIndex={0}
                aria-label="Colar imagens do clipboard"
              >
                <strong>{isUploading ? "Enviando imagens..." : "Colar imagens"}</strong>
                <span>Copie uma imagem, clique aqui e pressione Cmd+V ou Ctrl+V.</span>
              </div>
              <div className="adminChecks">
                <label><input type="checkbox" checked={productForm.active} onChange={(event) => setProductForm((current) => ({ ...current, active: event.target.checked }))} /> Ativo</label>
                <label><input type="checkbox" checked={productForm.recommended} onChange={(event) => setProductForm((current) => ({ ...current, recommended: event.target.checked }))} /> Recomendado</label>
              </div>
              {productForm.photoUrls.length > 0 && (
                <div className="adminGalleryPreview">
                  {productForm.photoUrls.map((url) => (
                    <figure key={url}>
                      <img src={url} alt="Preview do produto" />
                      <button type="button" onClick={() => setProductForm((current) => ({ ...current, photoUrls: current.photoUrls.filter((item) => item !== url) }))}>Remover</button>
                    </figure>
                  ))}
                </div>
              )}
              <div className="adminFormActions">
                <button type="submit">{productForm.id ? "Salvar alteracoes" : "Criar produto"}</button>
                <button type="button" className="secondary" onClick={resetProductForm}>Limpar</button>
              </div>
            </form>
          </section>
          )}

          {currentSection === "categorias" && (
          <section id="categorias" className="adminCard">
            <div className="adminCardHeader">
              <div>
                <span>Organizacao</span>
                <h2>Categorias</h2>
              </div>
            </div>
            <form className="adminCleanForm" onSubmit={createCategory}>
              <label>
                Nome
                <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Action figures" required />
              </label>
              <label>
                Descricao
                <input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="Opcional" />
              </label>
              <button type="submit">Criar categoria</button>
            </form>
            <div className="categoryList">
              {categories.map((category) => (
                <article key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                    <span>{category.slug}</span>
                  </div>
                  <button type="button" onClick={() => removeCategory(category)}>Remover</button>
                </article>
              ))}
              {categories.length === 0 && <p>Nenhuma categoria cadastrada.</p>}
            </div>
          </section>
          )}
        </div>
        )}

        {currentSection === "sorteios" && (
        <section id="sorteios" className="adminCard">
          <div className="adminCardHeader">
            <div>
              <span>Hellpoints</span>
              <h2>Sorteio de lançamento</h2>
            </div>
            <button type="button" onClick={() => loadLaunchRaffle()}>Atualizar</button>
          </div>

          <div className="adminRaffleSummary">
            <div>
              <span>Prêmio</span>
              <strong>{launchRaffle?.prize ?? "Controle 8BitDo original"}</strong>
            </div>
            <div>
              <span>Meta de cadastros</span>
              <strong>{formatNumber(launchRaffle?.registeredCount)} / {formatNumber(launchRaffle?.goal ?? 125)}</strong>
            </div>
            <div>
              <span>Tickets colocados</span>
              <strong>{formatNumber(launchRaffle?.totalTickets)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{launchRaffle?.unlocked ? "Liberado" : "Aguardando meta"}</strong>
            </div>
          </div>
          <div className="adminRaffleProgress" aria-label={`${launchRaffleProgress}% da meta`}>
            <span style={{ width: `${launchRaffleProgress}%` }} />
          </div>

          <div className="adminRaffleTable">
            {(launchRaffle?.participants ?? []).map((participant) => (
              <article key={participant.userId}>
                <div>
                  <strong>{participant.name}</strong>
                  <span>{participant.email}</span>
                </div>
                <strong>{formatNumber(participant.ticketCount)} tickets</strong>
              </article>
            ))}
            {(launchRaffle?.participants.length ?? 0) === 0 && <p className="adminEmpty">Nenhum ticket colocado neste sorteio ainda.</p>}
          </div>
        </section>
        )}

        {currentSection === "vendas" && (
        <section id="vendas" className="adminCard">
          <div className="adminCardHeader">
            <div>
              <span>Ecommerce</span>
              <h2>Relatório de vendas</h2>
            </div>
            <button type="button" onClick={() => loadSalesReport()}>Atualizar</button>
          </div>

            <div className="adminSalesSummary">
            <div>
              <span>Vendas concluídas</span>
              <strong>{formatNumber(salesReport?.summary.saleCount)}</strong>
            </div>
            <div>
              <span>Total vendido</span>
              <strong>{formatCents(salesReport?.summary.totalCents)}</strong>
            </div>
            <div>
              <span>Itens vendidos</span>
              <strong>{formatNumber(salesReport?.summary.itemCount)}</strong>
            </div>
              <div>
                <span>Ticket médio</span>
                <strong>{formatCents(salesReport?.summary.averageTicketCents)}</strong>
              </div>
            </div>

          <div className="adminSalesLayout">
            <section className="adminSalesPanel">
              <h3>Produtos vendidos</h3>
              <div className="adminSoldProducts">
                {(salesReport?.productBreakdown ?? []).map((item, index) => (
                  <article key={item.productId ?? item.name}>
                    <span className="adminSalesRank">{index + 1}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatNumber(item.quantity)} unidade(s)</span>
                    </div>
                    <strong>{formatCents(item.totalCents)}</strong>
                  </article>
                ))}
                {(salesReport?.productBreakdown.length ?? 0) === 0 && <p className="adminEmpty">Nenhuma venda concluída ainda.</p>}
              </div>
            </section>

            <section className="adminSalesPanel">
              <h3>Histórico de pedidos</h3>
              <div className="adminSalesHistory">
                {(salesReport?.sales ?? []).map((sale) => (
                  <article key={sale.id}>
                    <div className="adminSalesCustomer">
                      <strong>{sale.userEmail}</strong>
                      <span>{new Date(sale.approvedAt).toLocaleString("pt-BR")}</span>
                      <small>Pedido {sale.paymentId.slice(0, 8)}</small>
                    </div>
                    <div className="adminSalesItems">
                      {sale.items.map((item) => <span key={`${sale.id}-${item.productId ?? item.name}`}>{item.quantity}x {item.name}</span>)}
                    </div>
                    <div className="adminSalesTotal">
                      <strong>{formatCents(sale.totalCents)}</strong>
                      {sale.couponCode && <span>Cupom {sale.couponCode} · -{formatCents(sale.discountCents)}</span>}
                    </div>
                  </article>
                ))}
                {(salesReport?.sales.length ?? 0) === 0 && <p className="adminEmpty">Nenhuma venda registrada.</p>}
              </div>
            </section>
          </div>
        </section>
        )}

        {currentSection === "carrinhos" && (
        <section id="carrinhos" className="adminCard">
          <div className="adminCardHeader">
            <div>
              <span>Marketing e recuperação</span>
              <h2>Carrinhos ativos</h2>
            </div>
            <button type="button" onClick={() => loadCartActivities()}>Atualizar</button>
          </div>

          <p className="adminSectionDescription">Clientes cadastrados que ainda possuem itens no carrinho. Carrinhos são removidos desta lista quando o cliente finaliza uma compra.</p>

          <div className="adminCartTable">
            {cartActivities.map((cart) => (
              <article key={cart.userId}>
                <div>
                  <strong>{cart.userName || "Cliente"}</strong>
                  <span>{cart.userEmail}</span>
                  <small>Atualizado em {new Date(cart.updatedAt).toLocaleString("pt-BR")}</small>
                  <small>{cart.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}</small>
                </div>
                <div className="adminCartValue">
                  <strong>{formatCents(cart.subtotalCents)}</strong>
                  <span>{cart.reminderSentAt ? "Lembrete enviado" : `Lembrete após ${new Date(cart.remindAfter).toLocaleString("pt-BR")}`}</span>
                  <a href={`mailto:${cart.userEmail}`}>Entrar em contato</a>
                </div>
              </article>
            ))}
            {cartActivities.length === 0 && <p className="adminEmpty">Nenhum carrinho ativo no momento.</p>}
          </div>
        </section>
        )}

        {currentSection === "catalogo" && (
        <section id="lista" className="adminCard">
          <div className="adminCardHeader">
            <div>
              <span>Catalogo publicado</span>
              <h2>Produtos</h2>
            </div>
            <div className="adminHeaderActions">
              <select value={catalogTagFilter} onChange={(event) => setCatalogTagFilter(event.target.value)} aria-label="Filtrar catálogo por tag">
                <option value="">Todas as tags</option>
                {catalogTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <button type="button" onClick={() => loadAdminData()}>Atualizar</button>
            </div>
          </div>

          <div className="adminProductTable">
            {visibleCatalogProducts.map((product) => (
              <article key={product.id}>
                <img src={product.photoUrls?.[0] ?? product.photoUrl} alt={product.name} />
                <div>
                  <strong>{product.name}</strong>
                  <span>{categoriesById.get(product.categoryId) ?? "Sem categoria"} · {formatPrice(product)} · {product.stock} un.</span>
                  {product.variations?.length ? <small>Variacoes: {variationSummary(product)}</small> : null}
                  <small>{product.tags.join(", ") || "Sem tags"}</small>
                </div>
                <div className="adminStatus">
                  <span className={product.active ? "ok" : "muted"}>{product.active ? "Ativo" : "Inativo"}</span>
                  <span className={product.stock > 0 ? "ok" : "muted"}>{product.stock > 0 ? `${product.stock} em estoque` : "Sem estoque"}</span>
                </div>
                <div className="adminRowActions">
                  <button type="button" onClick={() => editProduct(product)}>Editar</button>
                  <button type="button" onClick={() => toggleRecommended(product)}>{product.recommended ? "Tirar destaque" : "Destacar"}</button>
                  <button type="button" className="danger" onClick={() => removeProduct(product)}>Remover</button>
                </div>
              </article>
            ))}
            {visibleCatalogProducts.length === 0 && <p className="adminEmpty">Nenhum produto encontrado para esta tag.</p>}
          </div>
        </section>
        )}

        {currentSection === "usuarios" && (
        <section id="usuarios" className="adminCard">
          <div className="adminCardHeader">
            <div>
              <span>Contas cadastradas</span>
              <h2>Usuarios</h2>
            </div>
            <div className="adminHeaderActions">
              <select value={userFilter} onChange={(event) => setUserFilter(event.target.value as UserFilter)} aria-label="Filtrar usuários">
                <option value="recentes">Recentes</option>
                <option value="antigos">Antigos</option>
                <option value="compradores">Compradores</option>
                <option value="carrinho">Carrinho ativo</option>
                <option value="cadastro">Só cadastro</option>
              </select>
              <button type="button" onClick={() => loadAdminData()}>Atualizar</button>
            </div>
          </div>

          <div className="adminUserTable">
            {visibleUsers.map((user) => (
              <article key={user.id}>
                <div>
                  <strong>{user.email}</strong>
                  <span>{user.name || "Sem nome"} · {user.role === "admin" ? "Admin" : user.role === "partner" ? "Parceiro" : "Cliente"}</span>
                  {user.phone && <small>{user.phone}</small>}
                  {user.partnerCouponCode && <small>Cupom {user.partnerCouponCode} · {user.partnerDiscountPercent ?? 10}%</small>}
                </div>
                <div className="adminStatus">
                  <span className={user.role === "admin" || user.role === "partner" ? "ok" : "muted"}>{user.role === "admin" ? "Admin" : user.role === "partner" ? "Parceiro" : "Cliente"}</span>
                  {user.banned && <span className="danger">Banido</span>}
                  <span>{formatNumber(user.hellpoints)} HP</span>
                  <span>{formatNumber(user.raffleTickets)} tickets</span>
                </div>
                <div className="adminRowActions">
                  <button type="button" disabled={user.role === "admin"} onClick={() => toggleUserPartner(user)}>
                    {user.role === "partner" ? "Remover parceiro" : "Tornar parceiro"}
                  </button>
                  {user.role === "partner" && (
                    <button type="button" onClick={() => updatePartnerCoupon(user)}>
                      Editar cupom
                    </button>
                  )}
                  <button type="button" disabled={user.role === "admin"} onClick={() => toggleUserBan(user)}>
                    {user.banned ? "Desbanir" : "Banir"}
                  </button>
                  <button type="button" className="danger" disabled={user.role === "admin"} onClick={() => deleteUser(user)}>
                    Deletar
                  </button>
                </div>
              </article>
            ))}
            {visibleUsers.length === 0 && <p className="adminEmpty">Nenhum usuário encontrado para este filtro.</p>}
          </div>
        </section>
        )}
      </section>
    </main>
  );
}
