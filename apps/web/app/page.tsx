"use client";

import { ArrowDown, ArrowUpRight, Github, Instagram, Linkedin } from "lucide-react";
import { useMemo, useState } from "react";

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
  }
];

function RotatingScrollIndicator() {
  return (
    <div className="scrollIndicator" aria-label="Scroll down">
      <svg className="scrollText" viewBox="0 0 144 144" aria-hidden="true">
        <defs>
          <path id="scroll-path" d="M72 72 m -53 0 a 53 53 0 1 1 106 0 a 53 53 0 1 1 -106 0" />
        </defs>
        <text>
          <textPath href="#scroll-path">Scroll Down • Scroll Down • Scroll Down • Scroll Down • </textPath>
        </text>
      </svg>
      <ArrowDown size={34} strokeWidth={2.5} />
    </div>
  );
}

export default function Page() {
  const [activeCategory, setActiveCategory] = useState("All");
  const visibleProducts = useMemo(() => {
    if (activeCategory === "All") {
      return products;
    }

    if (activeCategory === "Recommended") {
      return products.filter((product) => product.recommended);
    }

    return products.filter((product) => product.category === activeCategory);
  }, [activeCategory]);

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
        <h1>HELLCIFE GEEK</h1>
        <div className="heroMeta">
          <div>
            <span>Based in</span>
            <strong>Recife, Brazil</strong>
          </div>
          <RotatingScrollIndicator />
          <div className="role">
            <span>Geek imports market</span>
            <strong>JAPAN DROPS<br />RARE FIGURES<br />MANGA SUPPLY<br />NO FAKE STOCK</strong>
          </div>
        </div>
      </section>

      <section id="work" className="marketplacePortfolio">
        <div className="filterBar" aria-label="Marketplace filters">
          {categories.map((category) => (
            <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>
              {category}
            </button>
          ))}
        </div>

        <div className="productGrid">
          {visibleProducts.map((product) => (
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
