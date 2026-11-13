import { useRef } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { trpc, type Out } from "@/lib/trpc";
import { imageFor, useShop } from "@/lib/shop";
import { Spinner, cx } from "@/components/ui";
import { ProductCard } from "@/components/ProductCard";

type HomeData = Out["store"]["home"];
type Panel = { image: string; href: string; label?: string };

/* ───────────── Portada: fotos completas a sangre ───────────── */

function HeroPanel({ panel, progress, eager, className }: { panel: Panel; progress: MotionValue<number>; eager?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const scale = useTransform(progress, [0, 1], [1, 1.08]);
  return (
    <Link href={panel.href} className={cx("group relative block overflow-hidden bg-tile", className)} aria-label={panel.label}>
      <motion.img
        src={panel.image}
        alt=""
        style={reduce ? undefined : { scale }}
        fetchPriority={eager ? "high" : "auto"}
        className="absolute inset-0 size-full object-cover transition-opacity duration-700 group-hover:opacity-90"
      />
      {panel.label && (
        <span className="caps absolute bottom-5 left-5 hidden text-ink md:block">{panel.label}</span>
      )}
    </Link>
  );
}

function Hero({ data }: { data: HomeData }) {
  const home = useShop()!.settings.home;
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const href = home.heroCtaHref || "/tienda";

  const fromProduct = (p: HomeData["heroProduct"] | HomeData["featured"][number] | null | undefined): Panel | null => {
    const img = p ? imageFor(p.images, p.colors[0]?.name) : undefined;
    return p && img ? { image: img, href: `/producto/${p.slug}`, label: p.name } : null;
  };

  let panels: Panel[];
  if (home.heroImageUrl) {
    panels = [{ image: home.heroImageUrl, href }];
    if (home.heroImage2Url) panels.push({ image: home.heroImage2Url, href });
  } else {
    const left = fromProduct(data.heroProduct) ?? fromProduct(data.featured[0]);
    const right =
      fromProduct(data.showcase) ??
      fromProduct(data.featured.find((f) => f.id !== data.heroProduct?.id && f.slug !== left?.href.split("/").pop()));
    panels = [left, right].filter((x): x is Panel => Boolean(x));
  }

  if (panels.length === 0) {
    return (
      <section className="edge grid min-h-[60svh] place-items-center text-center">
        <div>
          <h1 className="display text-[clamp(2rem,5vw,3.5rem)]">{home.heroTitle}</h1>
          <Link href={href} className="caps link mt-6 inline-block">
            {home.heroCtaLabel || "Comprar ahora"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative" aria-label={home.heroTitle}>
      <div className={cx("grid h-[calc(100svh-64px)] min-h-[520px] sm:h-[calc(100svh-76px)]", panels.length > 1 && "md:grid-cols-2")}>
        {panels.map((p, i) => (
          <HeroPanel key={i} panel={p} progress={scrollYProgress} eager={i === 0} className={i > 0 ? "hidden md:block" : undefined} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center bg-gradient-to-t from-paper/80 via-paper/30 to-transparent px-6 pb-12 pt-24 text-center sm:pb-16">
        <h1 className="caps !text-[13px] !tracking-[0.24em] text-ink sm:!text-[15px]">{home.heroTitle}</h1>
        <Link href={href} className="caps link pointer-events-auto mt-4 text-ink">
          {home.heroCtaLabel || "Comprar ahora"}
        </Link>
      </div>
    </section>
  );
}

/* ───────────── Secciones ───────────── */

function SectionHead({ title, href, label }: { title: string; href?: string; label?: string }) {
  return (
    <div className="edge mb-6 flex items-baseline justify-between gap-6">
      <h2 className="caps">{title}</h2>
      {href && (
        <Link href={href} className="caps link text-ink-2">
          {label ?? "Ver todo"}
        </Link>
      )}
    </div>
  );
}

function Rail({ items }: { items: HomeData["featured"] }) {
  if (items.length === 0) return null;
  return (
    <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-[clamp(16px,2.2vw,32px)] sm:gap-3">
      {items.map((p, i) => (
        <div key={p.id} className="w-[72vw] shrink-0 snap-start sm:w-[44vw] lg:w-[calc((100vw-2*clamp(16px,2.2vw,32px)-3*12px)/4)]">
          <ProductCard product={p} eager={i < 2} />
        </div>
      ))}
    </div>
  );
}

function Categories({ items }: { items: HomeData["categories"] }) {
  const tiles = items.filter((c) => c.imageUrl).slice(0, 3);
  if (tiles.length === 0) return null;
  return (
    <section className="pt-24 sm:pt-32" aria-labelledby="categorias">
      <h2 id="categorias" className="sr-only">
        Categorías
      </h2>
      <div className={cx("grid gap-px", tiles.length === 2 && "md:grid-cols-2", tiles.length === 3 && "md:grid-cols-3")}>
        {tiles.map((c) => (
          <Link key={c.id} href={`/categoria/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-tile">
            <img
              src={c.imageUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition-transform duration-[1.2s] ease-apple group-hover:scale-[1.03]"
            />
            <span
              className={cx(
                "absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6",
                c.hasCustomImage && "bg-gradient-to-t from-black/45 to-transparent text-white",
              )}
            >
              <span className="caps">{c.name}</span>
              <span className="caps link">Comprar</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Word({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: string }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}

function Story() {
  const home = useShop()!.settings.home;
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.6"] });
  const words = home.storyText.trim().split(/\s+/).filter(Boolean);
  if (!home.storyTitle && words.length === 0) return null;
  return (
    <section className="edge pt-28 text-center sm:pt-40" aria-labelledby="historia">
      {home.storyTitle && (
        <h2 id="historia" className="caps text-ink-2">
          {home.storyTitle}
        </h2>
      )}
      {words.length > 0 && (
        <p ref={ref} className="headline mx-auto mt-6 max-w-[34ch] text-[clamp(1.35rem,2.6vw,2rem)]">
          {reduce
            ? words.join(" ")
            : words.map((w, i) => (
                <Word key={i} progress={scrollYProgress} range={[i / words.length, Math.min(1, (i + 3) / words.length)]}>
                  {w}
                </Word>
              ))}
        </p>
      )}
    </section>
  );
}

function Perks() {
  const perks = useShop()!.settings.home.perks;
  if (perks.length === 0) return null;
  return (
    <section className="edge pt-28 sm:pt-36" aria-label="Por qué comprar aquí">
      <ul className={cx("grid gap-px border-y border-line sm:grid-cols-2", perks.length >= 3 && "lg:grid-cols-3", perks.length >= 4 && "lg:grid-cols-4")}>
        {perks.map((perk, i) => (
          <li key={i} className="py-8 text-center sm:px-6">
            <h3 className="caps">{perk.title}</h3>
            <p className="mx-auto mt-2 max-w-[30ch] text-[14px] text-ink-2">{perk.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  const { data, isLoading } = trpc.store.home.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid h-[80svh] place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <Hero data={data} />
      {data.latest.length > 0 && (
        <section className="pt-16 sm:pt-24" aria-label="Novedades">
          <SectionHead title="Novedades" href="/tienda?nuevo=1" />
          <div className="edge">
            <div className="grid grid-cols-2 gap-x-2 gap-y-10 sm:gap-x-3 lg:grid-cols-4">
              {data.latest.slice(0, 8).map((p, i) => (
                <ProductCard key={p.id} product={p} eager={i < 4} />
              ))}
            </div>
          </div>
        </section>
      )}
      <Categories items={data.categories} />
      {data.featured.length > 0 && (
        <section className="pt-24 sm:pt-32" aria-label="Destacados">
          <SectionHead title="Lo más pedido" href="/tienda" label="Ver la tienda" />
          <Rail items={data.featured} />
        </section>
      )}
      <Story />
      <Perks />
    </>
  );
}
