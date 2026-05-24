"use client";

import gsap from "gsap";
import { ArrowUp, ArrowUpRight, X } from "lucide-react";
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
  { label: "Home", href: "#top" },
  { label: "Produtos", href: "#work" },
  { label: "Catalogo", href: "#services" },
  { label: "Contato", href: "#contact" }
];

const categories = ["All", "Recommended", "Availability", "SKU", "Talent", "On-demand", "Directory"];
const productsPerPage = 6;

const products = [
  {
    title: "Rental Slot OS",
    category: "Availability",
    price: "R$ 18K",
    status: "Live logic",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
    recommended: true,
    tags: ["Calendar", "Fees", "Policy"]
  },
  {
    title: "Creator Proposal Desk",
    category: "Talent",
    price: "R$ 24K",
    status: "Milestones",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
    recommended: true,
    tags: ["Profiles", "Chat", "Escrow"]
  },
  {
    title: "Hard Goods Grid",
    category: "SKU",
    price: "R$ 16K",
    status: "Cart ready",
    image: "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=900&q=80",
    recommended: false,
    tags: ["Variants", "Shipping", "Compare"]
  },
  {
    title: "Fast Dispatch Layer",
    category: "On-demand",
    price: "R$ 21K",
    status: "ETA first",
    image: "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80",
    recommended: true,
    tags: ["ETA", "Distance", "Fees"]
  },
  {
    title: "Vendor Proof Matrix",
    category: "Directory",
    price: "R$ 14K",
    status: "Lead capture",
    image: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80",
    recommended: false,
    tags: ["Reviews", "Matrix", "Contact"]
  },
  {
    title: "Event Booth Market",
    category: "Availability",
    price: "R$ 19K",
    status: "Conflict safe",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80",
    recommended: false,
    tags: ["Slots", "Map", "Cancel"]
  },
  {
    title: "Akiba Import Shelf",
    category: "SKU",
    price: "R$ 12K",
    status: "Stock sync",
    image: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=900&q=80",
    recommended: true,
    tags: ["Figures", "Manga", "Drops"]
  },
  {
    title: "Rare Figure Queue",
    category: "On-demand",
    price: "R$ 17K",
    status: "Drop alert",
    image: "https://images.unsplash.com/photo-1608889476561-6242cfdbf622?auto=format&fit=crop&w=900&q=80",
    recommended: false,
    tags: ["Queue", "ETA", "Notify"]
  },
  {
    title: "Cosplay Maker Board",
    category: "Talent",
    price: "R$ 20K",
    status: "Quote flow",
    image: "https://images.unsplash.com/photo-1608889825205-eebdb9fc5806?auto=format&fit=crop&w=900&q=80",
    recommended: false,
    tags: ["Brief", "Proof", "Chat"]
  },
  {
    title: "Japan Club Finder",
    category: "Directory",
    price: "R$ 11K",
    status: "Lead ready",
    image: "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=900&q=80",
    recommended: true,
    tags: ["Clubs", "Reviews", "Map"]
  },
  {
    title: "Booth Reserve Flow",
    category: "Availability",
    price: "R$ 23K",
    status: "Calendar lock",
    image: "https://images.unsplash.com/photo-1578898887932-dce23a595ad4?auto=format&fit=crop&w=900&q=80",
    recommended: false,
    tags: ["Events", "Slots", "Fees"]
  },
  {
    title: "Preorder Cart Core",
    category: "SKU",
    price: "R$ 15K",
    status: "Preorder safe",
    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=900&q=80",
    recommended: true,
    tags: ["Deposit", "Tax", "Ship"]
  }
];

function ChromeMark() {
  return (
    <svg className="brandIcon chromeMark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#fbbc05" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 12 6.85 3.08A10 10 0 0 1 21.3 9H12Z" fill="#ea4335" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 12h10a10 10 0 0 1-15.15 8.55Z" fill="#34a853" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="4.2" fill="#4285f4" stroke="currentColor" strokeWidth="1.8" />
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

function RotatingScrollIndicator() {
  const indicatorRef = useRef<HTMLAnchorElement>(null);
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
    <a ref={indicatorRef} className="scrollIndicator" href="#work" aria-label="Descer para produtos">
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
    </a>
  );
}

function HeroHeadline() {
  return (
    <div className="heroHeadline" aria-label="HELLCIFE GEEK">
      <h1 className="mainHeadline">HELLCIFE GEEK</h1>
      <h1 className="altHeadline" aria-hidden="true">FIGURES ORIGINAIS</h1>
    </div>
  );
}

export default function Page() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(productsPerPage);
  const visibleProducts = useMemo(() => {
    if (activeCategory === "All") {
      return products;
    }

    if (activeCategory === "Recommended") {
      return products.filter((product) => product.recommended);
    }

    return products.filter((product) => product.category === activeCategory);
  }, [activeCategory]);
  const displayedProducts = visibleProducts.slice(0, visibleCount);
  const canShowMore = visibleCount < visibleProducts.length;

  function selectCategory(category: string) {
    setActiveCategory(category);
    setVisibleCount(productsPerPage);
  }

  return (
    <main>
      <a className="logo" href="#top">HCG</a>
      <nav className="nav">
        <div className="navPill" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.label} href={item.href}>{item.label}</a>
          ))}
          <a className="loginLink" href="#login-modal" aria-haspopup="dialog">Login</a>
        </div>
      </nav>

      <section id="top" className="hero">
        <div className="heroCode">MKP-RED / TWO-SIDED SYSTEM / RECIFE-BR</div>
        <HeroHeadline />
        <div className="heroMeta">
          <div>
            <span>Based in</span>
            <strong>Recife, Brazil</strong>
          </div>
          <RotatingScrollIndicator />
          <div className="role">
            <span>Importados</span>
            <strong>DROPS DO JAPAO<br />FIGURES RARAS<br />MANGAS E BOTTONS<br />PRONTA ENTREGA</strong>
          </div>
        </div>
      </section>

      <section id="work" className="marketplacePortfolio">
        <div className="filterBar" aria-label="Marketplace filters">
          {categories.map((category) => (
            <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => selectCategory(category)}>
              {category}
            </button>
          ))}
        </div>

        <div className="productGrid">
          {displayedProducts.map((product) => (
            <article key={product.title} className="productCard">
              <div className="productImage">
                <img src={product.image} alt={product.title} />
                {product.recommended && <span>Recommended</span>}
              </div>
              <div className="productBody">
                <div className="productMeta">
                  <span>{product.category}</span>
                  <strong>{product.price}</strong>
                </div>
                <h3>{product.title}</h3>
                <div className="productTags">
                  {product.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <a href="#contact">
                  <span>{product.status}</span>
                  <ArrowUpRight size={28} strokeWidth={2.5} />
                </a>
              </div>
            </article>
          ))}
        </div>

        {canShowMore && (
          <button className="loadMore" onClick={() => setVisibleCount((current) => current + productsPerPage)}>
            Ver mais
            <span>{visibleProducts.length - visibleCount} restantes</span>
          </button>
        )}
      </section>

      <section id="services" className="services">
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
        <p>Ready state / No soft launch</p>
        <h2>SHIP THE MARKET</h2>
        <a href="mailto:hello@hellcifegeek.dev">Start the build</a>
      </section>

      <section className="marqueeSection footerRibbon">
        <div className="marqueeTrack">
          <div className="marqueeLine">
            <span>DISCOVERY ENGINE • TRUST LAYER • FEE LOGIC • </span>
            <span>DISCOVERY ENGINE • TRUST LAYER • FEE LOGIC • </span>
          </div>
          <div className="marqueeLine reverse">
            <span>NO GLASS • NO GRADIENTS • NO GENERIC DASHBOARDS • </span>
            <span>NO GLASS • NO GRADIENTS • NO GENERIC DASHBOARDS • </span>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>© 2026 Hellcife Geek</span>
        <div>
          <a href="#">Instagram</a>
          <a href="#">Github</a>
          <a href="#">Linkedin</a>
        </div>
      </footer>

      <div id="login-modal" className="modalOverlay" role="presentation">
        <section className="authModal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <div className="authHeader">
            <div>
              <span>Acesso</span>
              <h2 id="auth-title">Entrar na conta</h2>
            </div>
            <a className="closeModal" href="#" aria-label="Fechar modal">
              <X size={22} strokeWidth={3} />
            </a>
          </div>

          <div className="authChoices">
            <button type="button">
              <ChromeMark />
              <span>Entrar com Chrome</span>
            </button>
            <button type="button">
              <AppleMark />
              <span>Entrar com Apple</span>
            </button>
            <a className="manualButton" href="#signup-modal">
              <span>Cadastro manual</span>
              <ArrowUpRight size={22} strokeWidth={2.5} />
            </a>
          </div>
        </section>
      </div>

      <div id="signup-modal" className="modalOverlay" role="presentation">
        <section className="authModal" role="dialog" aria-modal="true" aria-labelledby="signup-title">
          <div className="authHeader">
            <div>
              <span>Cadastro manual</span>
              <h2 id="signup-title">Criar conta</h2>
            </div>
            <a className="closeModal" href="#" aria-label="Fechar modal">
              <X size={22} strokeWidth={3} />
            </a>
          </div>

          <form className="manualForm">
            <label>
              Email
              <input type="email" name="email" placeholder="voce@email.com" required />
            </label>
            <label>
              Senha
              <input type="password" name="password" placeholder="Minimo 8 caracteres" minLength={8} required />
            </label>
            <label>
              Numero de celular <span>Opcional</span>
              <input type="tel" name="phone" placeholder="(81) 99999-9999" />
            </label>
            <div className="authActions">
              <a href="#login-modal">Voltar</a>
              <button type="submit">Cadastrar</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
