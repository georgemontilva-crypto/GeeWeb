import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { imageFor, useMoney, useShop } from "@/lib/shop";
import { cart, useCart } from "@/lib/cart";
import { trpc } from "@/lib/trpc";
import { CartDrawer } from "./CartDrawer";
import { IconButton, Spinner, cx } from "./ui";

const EASE = [0.28, 0.11, 0.32, 1] as const;

/** Logo de la tienda. Mientras no haya uno subido, se muestra el nombre. */
export function Brand({ className }: { className?: string }) {
  const shop = useShop()!;
  const { logoUrl, storeName } = shop.settings;
  return (
    <Link href="/" aria-label={`${storeName}, ir al inicio`} className={cx("inline-flex items-center", className)}>
      {logoUrl ? (
        <img src={logoUrl} alt={storeName} className="h-7 w-auto max-w-[150px] object-contain" />
      ) : (
        <span className="text-[21px] font-semibold tracking-[-0.045em] [font-stretch:88%]">{storeName}</span>
      )}
    </Link>
  );
}

function useNavLinks() {
  const shop = useShop()!;
  return {
    main: [
      { label: "Tienda", href: "/tienda" },
      { label: "Novedades", href: "/tienda?nuevo=1" },
      ...shop.categories.slice(0, 3).map((c) => ({ label: c.name, href: `/categoria/${c.slug}` })),
      ...shop.pages
        .filter((p) => p.showInNav)
        .slice(0, 2)
        .map((p) => ({ label: p.title, href: `/${p.slug}` })),
    ],
    all: [
      { label: "Tienda", href: "/tienda" },
      { label: "Novedades", href: "/tienda?nuevo=1" },
      ...shop.categories.map((c) => ({ label: c.name, href: `/categoria/${c.slug}` })),
      ...shop.pages.filter((p) => p.showInNav).map((p) => ({ label: p.title, href: `/${p.slug}` })),
      { label: "Seguir mi pedido", href: "/seguimiento" },
    ],
  };
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const money = useMoney();
  const [, navigate] = useLocation();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 220);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = trpc.store.products.useQuery({ search: term, sort: "destacados" }, { enabled: term.length >= 2 });
  const results = (q.data?.items ?? []).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[70]">
      <motion.div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar productos"
        className="absolute inset-x-3 top-3 mx-auto max-w-[720px] overflow-hidden rounded-[28px] bg-white shadow-sheet"
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <form
          className="flex items-center gap-3 px-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              navigate(`/tienda?q=${encodeURIComponent(text.trim())}`);
              onClose();
            }
          }}
        >
          <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Busca camisetas, hoodies, pantalones…"
            aria-label="Buscar productos"
            className="h-16 min-w-0 flex-1 bg-transparent text-[19px] placeholder:text-ink-3 focus:outline-none"
          />
          <IconButton label="Cerrar la búsqueda" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </form>
        {term.length >= 2 && (
          <div className="border-t border-mist-2 p-3">
            {q.isLoading ? (
              <div className="grid place-items-center py-8">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-[15px] text-ink-2">
                No encontramos nada con “{term}”. Prueba con otra palabra.
              </p>
            ) : (
              <ul>
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/producto/${p.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-4 rounded-[18px] p-2 transition-colors hover:bg-mist"
                    >
                      <span className="h-16 w-[52px] shrink-0 overflow-hidden rounded-[12px] bg-mist">
                        {imageFor(p.images, p.colors[0]?.name) && (
                          <img src={imageFor(p.images, p.colors[0]?.name)} alt="" className="size-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold tracking-[-0.02em]">{p.name}</span>
                        <span className="block truncate text-[14px] text-ink-2">{p.tagline}</span>
                      </span>
                      <span className="shrink-0 pr-2 text-[15px] tabular-nums">{money(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Header() {
  const { count } = useCart();
  const links = useNavLinks();
  const [path] = useLocation();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menu]);

  return (
    <>
      <header className="pointer-events-none sticky top-3 z-50 -mb-[52px] px-3">
        <nav
          aria-label="Principal"
          className="glass pointer-events-auto mx-auto flex h-[52px] max-w-[1080px] items-center gap-2 rounded-full pl-6 pr-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_28px_-12px_rgba(0,0,0,0.22)]"
        >
          <Brand />
          <ul className="mx-auto hidden items-center gap-0.5 lg:flex">
            {links.main.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-full px-3.5 py-2 text-[14px] text-ink/85 transition-colors hover:bg-black/5 hover:text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center lg:ml-0">
            <IconButton label="Buscar" onClick={() => setSearch(true)} className="hover:bg-black/5">
              <Search className="size-[19px]" strokeWidth={1.8} />
            </IconButton>
            <IconButton
              label={count > 0 ? `Abrir la bolsa, ${count} artículos` : "Abrir la bolsa"}
              onClick={() => cart.open()}
              className="relative hover:bg-black/5"
            >
              <ShoppingBag className="size-[19px]" strokeWidth={1.8} />
              {count > 0 && (
                <span className="absolute right-1 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-white">
                  {count}
                </span>
              )}
            </IconButton>
            <IconButton label="Abrir el menú" onClick={() => setMenu(true)} className="hover:bg-black/5 lg:hidden">
              <Menu className="size-[20px]" strokeWidth={1.8} />
            </IconButton>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div
            className="glass fixed inset-0 z-[60] flex flex-col overflow-y-auto px-6 pb-10 pt-5 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
          >
            <div className="flex items-center justify-between">
              <Brand />
              <IconButton label="Cerrar el menú" onClick={() => setMenu(false)} className="-mr-2">
                <X className="size-6" />
              </IconButton>
            </div>
            <ul className="mt-10 flex flex-col gap-1">
              {links.all.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.04 + i * 0.035 }}
                >
                  <Link href={l.href} className="headline block py-1.5 text-[34px]">
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{search && <SearchSheet onClose={() => setSearch(false)} />}</AnimatePresence>
    </>
  );
}

function Footer() {
  const shop = useShop()!;
  const s = shop.settings;
  const footerPages = shop.pages.filter((p) => p.showInFooter);
  const social = [
    { label: "Instagram", href: s.instagram },
    { label: "TikTok", href: s.tiktok },
    { label: "Facebook", href: s.facebook },
  ].filter((x) => x.href);
  const wa = s.whatsapp.replace(/\D/g, "");

  const linkClass = "text-[14px] text-ink-2 transition-colors hover:text-ink";
  return (
    <footer className="mt-28 px-3 pb-3">
      <div className="rounded-panel bg-mist">
        <div className="wrap grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:py-20">
          <div>
            <Brand />
            <p className="mt-4 max-w-[30ch] text-[15px] text-ink-2">{s.tagline}</p>
          </div>
          <nav aria-label="Tienda">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Tienda</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/tienda" className={linkClass}>
                  Todos los productos
                </Link>
              </li>
              {shop.categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/categoria/${c.slug}`} className={linkClass}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Ayuda">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Ayuda</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/seguimiento" className={linkClass}>
                  Seguir mi pedido
                </Link>
              </li>
              {footerPages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`} className={linkClass}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Contacto</h2>
            <ul className="mt-4 space-y-2.5">
              {s.email && (
                <li>
                  <a href={`mailto:${s.email}`} className={linkClass}>
                    {s.email}
                  </a>
                </li>
              )}
              {wa && (
                <li>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={linkClass}>
                    WhatsApp
                  </a>
                </li>
              )}
              {s.phone && <li className="text-[14px] text-ink-2">{s.phone}</li>}
              {s.address && <li className="text-[14px] text-ink-2">{s.address}</li>}
              {social.map((x) => (
                <li key={x.label}>
                  <a href={x.href} target="_blank" rel="noreferrer" className={linkClass}>
                    {x.label}
                  </a>
                </li>
              ))}
              {!s.email && !wa && !s.phone && social.length === 0 && (
                <li className="text-[14px] text-ink-2">
                  <Link href="/contacto" className="hover:text-ink">
                    Escríbenos
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="wrap flex flex-wrap items-center justify-between gap-3 border-t border-black/8 py-6 text-[13px] text-ink-3">
          <p>
            © {new Date().getFullYear()} {s.storeName}. Todos los derechos reservados.
          </p>
          <Link href="/seguimiento" className="hover:text-ink">
            Seguir mi pedido
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function StoreLayout({ children }: { children: ReactNode }) {
  const shop = useShop()!;
  const { announcement, announcementHref } = shop.settings;
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      {announcement && (
        <div className="bg-mist text-center text-[13px] text-ink-2">
          {announcementHref ? (
            <Link href={announcementHref} className="block px-4 py-2.5 hover:text-ink">
              {announcement}
            </Link>
          ) : (
            <p className="px-4 py-2.5">{announcement}</p>
          )}
        </div>
      )}
      <Header />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
