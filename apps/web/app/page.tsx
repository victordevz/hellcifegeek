"use client";

import gsap from "gsap";
import { ArrowDown, ArrowUp, ArrowUpRight, Github, Instagram, Linkedin } from "lucide-react";
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
  { label: "Work", href: "#work" },
  { label: "Systems", href: "#services" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" }
];
const socialItems = [
  { label: "Instagram", icon: Instagram },
  { label: "Github", icon: Github },
  { label: "Linkedin", icon: Linkedin }
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
  const [headline, setHeadline] = useState("HELLCIFE GEEK");
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setIsChanging(true), 1300),
      window.setTimeout(() => {
        setHeadline("FIGURES ORIGINAIS");
        setIsChanging(false);
      }, 1800),
      window.setTimeout(() => setIsChanging(true), 3800),
      window.setTimeout(() => {
        setHeadline("HELLCIFE GEEK");
        setIsChanging(false);
      }, 4300)
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return <h1 className={isChanging ? "isChanging" : ""}>{headline}</h1>;
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
      <nav className="nav">
        <a className="logo" href="#top">HCG</a>
        <div className="navPill" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.label} href={item.href}>{item.label}</a>
          ))}
        </div>
        <div className="socials" aria-label="Social links">
          {socialItems.map(({ label, icon: Icon }) => (
            <a key={label} href="#" aria-label={label}>
              <Icon size={17} strokeWidth={2.5} />
            </a>
          ))}
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
            <strong>DROPS DO JAPAO<br />FIGURES RARAS<br />MANGAS E GOODS<br />PRONTA ENTREGA</strong>
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
    </main>
  );
}
