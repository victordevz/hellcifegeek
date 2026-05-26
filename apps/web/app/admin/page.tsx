"use client";

import type { ChangeEvent, ClipboardEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

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
};

type StoredUser = {
  role?: string;
};

type AdminUser = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role: "admin" | "client";
  hellpoints?: number;
  raffleTickets?: number;
  banned?: boolean;
  createdAt: string;
};

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  photoUrls: string[];
  tags: string;
  categoryId: string;
  active: boolean;
  recommended: boolean;
};

const emptyProductForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  stock: "0",
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

function normalizePrice(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function tagsToText(tags: string[]) {
  return tags.join(", ");
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(Number(value ?? 0))));
}

export default function AdminPage() {
  const [email, setEmail] = useState("admin@hellcifegeek.com.br");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
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

  function authHeaders(authToken = token) {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${authToken}`
    };
  }

  async function loadProducts() {
    const response = await fetch(`${apiUrl}/products`, { cache: "no-store" });
    const data = (await response.json()) as AdminProduct[];
    setProducts(data);
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
      setMessage("Nao foi possivel carregar os usuarios.");
      return;
    }

    const data = (await response.json()) as AdminUser[];
    setUsers(data);
  }

  async function loadAdminData(authToken = token) {
    await Promise.all([loadProducts(), loadCategories(), loadUsers(authToken)]);
  }

  useEffect(() => {
    const storedToken = localStorage.getItem("hellcifegeek.token");
    const storedUser = localStorage.getItem("hellcifegeek.user");
    const user = storedUser ? JSON.parse(storedUser) as StoredUser : null;

    if (!storedToken || user?.role !== "admin") {
      return;
    }

    setToken(storedToken);
    setMessage("Admin conectado.");
    void loadAdminData(storedToken);
  }, []);

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
      setMessage("Admin conectado.");
      await loadAdminData(data.token);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("hellcifegeek.token");
    localStorage.removeItem("hellcifegeek.user");
    setToken("");
    setProducts([]);
    setCategories([]);
    setUsers([]);
    setMessage("Sessao encerrada.");
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
    setProductForm({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      price: priceToInput(product),
      stock: String(product.stock ?? 0),
      photoUrls: product.photoUrls?.length ? product.photoUrls : [product.photoUrl].filter(Boolean),
      tags: tagsToText(product.tags),
      categoryId: product.categoryId,
      active: product.active,
      recommended: Boolean(product.recommended)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    setProductForm({
      ...emptyProductForm,
      categoryId: categories[0]?.id ?? ""
    });
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
      setMessage("Nao foi possivel salvar o produto.");
      return;
    }

    setMessage(productForm.id ? "Produto atualizado." : "Produto criado.");
    resetProductForm();
    await loadProducts();
  }

  async function toggleRecommended(product: AdminProduct) {
    const response = await fetch(`${apiUrl}/products/${product.id}/recommended`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ recommended: !product.recommended })
    });

    if (!response.ok) {
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
      setMessage("Nao foi possivel atualizar o usuario.");
      return;
    }

    setMessage(user.banned ? "Usuario desbanido." : "Usuario banido.");
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
          <a href="#produtos">Produtos</a>
          <a href="#categorias">Categorias</a>
          <a href="#usuarios">Usuarios</a>
          <a href="#lista">Catalogo</a>
        </nav>
        <button type="button" onClick={logout}>Sair</button>
      </aside>

      <section className="adminWorkspace">
        <header className="adminTopbar">
          <div>
            <span>Painel administrativo</span>
            <h1>Catalogo</h1>
          </div>
          <div className="adminStats">
            <strong>{products.length}<span>Produtos</span></strong>
            <strong>{activeProducts}<span>Ativos</span></strong>
            <strong>{totalStock}<span>Em estoque</span></strong>
            <strong>{recommendedProducts}<span>Recomendados</span></strong>
            <strong>{clientUsers.length}<span>Usuarios</span></strong>
          </div>
        </header>

        {message && <p className="adminNotice">{message}</p>}

        <div className="adminGrid">
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
        </div>

        <section id="lista" className="adminCard">
          <div className="adminCardHeader">
            <div>
              <span>Catalogo publicado</span>
              <h2>Produtos</h2>
            </div>
            <button type="button" onClick={() => loadAdminData()}>Atualizar</button>
          </div>

          <div className="adminProductTable">
            {products.map((product) => (
              <article key={product.id}>
                <img src={product.photoUrls?.[0] ?? product.photoUrl} alt={product.name} />
                <div>
                  <strong>{product.name}</strong>
                  <span>{categoriesById.get(product.categoryId) ?? "Sem categoria"} · {formatPrice(product)} · {product.stock} un.</span>
                  <small>{product.tags.join(", ") || "Sem tags"}</small>
                </div>
                <div className="adminStatus">
                  <span className={product.active ? "ok" : "muted"}>{product.active ? "Ativo" : "Inativo"}</span>
                  <span className={product.stock > 0 ? "ok" : "muted"}>{product.stock > 0 ? `${product.stock} em estoque` : "Sem estoque"}</span>
                  {product.recommended && <span className="ok">Recomendado</span>}
                </div>
                <div className="adminRowActions">
                  <button type="button" onClick={() => editProduct(product)}>Editar</button>
                  <button type="button" onClick={() => toggleRecommended(product)}>{product.recommended ? "Tirar destaque" : "Destacar"}</button>
                  <button type="button" className="danger" onClick={() => removeProduct(product)}>Remover</button>
                </div>
              </article>
            ))}
            {products.length === 0 && <p className="adminEmpty">Nenhum produto cadastrado ainda.</p>}
          </div>
        </section>

        <section id="usuarios" className="adminCard">
          <div className="adminCardHeader">
            <div>
              <span>Contas cadastradas</span>
              <h2>Usuarios</h2>
            </div>
            <button type="button" onClick={() => loadUsers()}>Atualizar</button>
          </div>

          <div className="adminUserTable">
            {users.map((user) => (
              <article key={user.id}>
                <div>
                  <strong>{user.email}</strong>
                  <span>{user.name || "Sem nome"} · {user.role === "admin" ? "Admin" : "Cliente"}</span>
                  {user.phone && <small>{user.phone}</small>}
                </div>
                <div className="adminStatus">
                  <span className={user.role === "admin" ? "ok" : "muted"}>{user.role === "admin" ? "Admin" : "Cliente"}</span>
                  {user.banned && <span className="danger">Banido</span>}
                  <span>{formatNumber(user.hellpoints)} HP</span>
                  <span>{formatNumber(user.raffleTickets)} tickets</span>
                </div>
                <div className="adminRowActions">
                  <button type="button" disabled={user.role === "admin"} onClick={() => toggleUserBan(user)}>
                    {user.banned ? "Desbanir" : "Banir"}
                  </button>
                  <button type="button" className="danger" disabled={user.role === "admin"} onClick={() => deleteUser(user)}>
                    Deletar
                  </button>
                </div>
              </article>
            ))}
            {users.length === 0 && <p className="adminEmpty">Nenhum usuario cadastrado ainda.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
