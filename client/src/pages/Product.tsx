import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMoney, useShop, type ProductDetail } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { Button, ButtonLink, EmptyState, Spinner, cx } from "@/components/ui";
import { Price, ProductGrid } from "@/components/ProductCard";

const EASE = [0.28, 0.11, 0.32, 1] as const;

/** Fotos completas: apiladas en pantallas grandes, deslizables en el celular. */
function Gallery({ images, alt, onOpen }: { images: string[]; alt: string; onOpen: (i: number) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    rail.current?.scrollTo({ left: 0 });
  }, [images]);

  return (
    <>
      {/* Celular */}
      <div className="relative lg:hidden">
        <div
          ref={rail}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Ampliar foto ${i + 1}`}
              className="relative aspect-[4/5] w-full shrink-0 snap-start bg-tile"
            >
              <img src={url} alt={i === 0 ? alt : ""} className="absolute inset-0 size-full object-cover" fetchPriority={i === 0 ? "high" : "auto"} />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <p className="caps pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 !text-[11px] tabular-nums">
            {index + 1} / {images.length}
          </p>
        )}
      </div>

      {/* Escritorio */}
      <div className={cx("hidden gap-1 lg:grid", images.length > 1 && "grid-cols-2")}>
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`Ampliar foto ${i + 1}`}
            className={cx(
              "relative block aspect-[4/5] cursor-zoom-in overflow-hidden bg-tile",
              images.length > 1 && i === 0 && images.length % 2 === 1 && "col-span-2",
            )}
          >
            <img src={url} alt={i === 0 ? alt : ""} className="absolute inset-0 size-full object-cover" fetchPriority={i === 0 ? "high" : "auto"} />
          </button>
        ))}
      </div>
    </>
  );
}

function Lightbox({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(images.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [images.length, onClose]);
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Fotos del producto"
      className="fixed inset-0 z-[90] flex flex-col bg-paper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="edge flex h-16 shrink-0 items-center justify-between">
        <p className="caps tabular-nums">
          {i + 1} / {images.length}
        </p>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 grid size-10 place-items-center hover:opacity-60">
          <X className="size-5" strokeWidth={1.2} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <img src={images[i]} alt="" className="absolute inset-0 size-full object-contain" />
        {i > 0 && (
          <button type="button" onClick={() => setI(i - 1)} className="caps absolute inset-y-0 left-0 w-1/3 text-left pl-6 opacity-0 hover:opacity-100" aria-label="Foto anterior">
            Anterior
          </button>
        )}
        {i < images.length - 1 && (
          <button type="button" onClick={() => setI(i + 1)} className="caps absolute inset-y-0 right-0 w-1/3 text-right pr-6 opacity-0 hover:opacity-100" aria-label="Foto siguiente">
            Siguiente
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Accordion({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-t border-line" open={open}>
      <summary className="caps flex list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-[16px] leading-none" aria-hidden>
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
      </summary>
      <div className="pb-6 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

function Buy({ product }: { product: ProductDetail }) {
  const shop = useShop()!;
  const money = useMoney();
  const initialColor = new URLSearchParams(useSearch()).get("color");
  const hasColors = product.colors.length > 0;
  const hasSizes = product.sizes.length > 0;

  const stockOf = (color: string, size: string) =>
    product.variants.find((v) => v.color === color && v.size === size)?.stock ?? 0;
  const colorStock = (color: string) =>
    product.variants.filter((v) => v.color === color).reduce((n, v) => n + v.stock, 0);

  const [color, setColor] = useState(() => {
    if (!hasColors) return "";
    const wanted = product.colors.find((c) => c.name === initialColor)?.name;
    return wanted ?? product.colors.find((c) => colorStock(c.name) > 0)?.name ?? product.colors[0]!.name;
  });
  const [size, setSize] = useState("");
  const [askSize, setAskSize] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const buyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialColor && product.colors.some((c) => c.name === initialColor)) setColor(initialColor);
  }, [initialColor, product.colors]);

  // Si la talla elegida no existe en el nuevo color, se limpia la selección.
  useEffect(() => {
    if (size && stockOf(color, size) <= 0) setSize("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBarVisible(!e!.isIntersecting && e!.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const variant = product.variants.find((v) => v.color === color && v.size === (hasSizes ? size : ""));
  const totalStock = product.variants.reduce((n, v) => n + v.stock, 0);
  const soldOut = totalStock <= 0;
  const needsSize = hasSizes && !size;
  const stock = variant?.stock ?? 0;

  const images = useMemo(() => {
    const mine = product.images.filter((i) => i.color === color || i.color === "");
    return (mine.length ? mine : product.images).map((i) => i.url);
  }, [product.images, color]);

  const add = () => {
    if (needsSize) {
      setAskSize(true);
      buyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!variant || stock <= 0) return;
    cart.add(variant.id, 1);
  };

  const label = soldOut
    ? "Agotado"
    : needsSize
      ? "Elige tu talla"
      : stock <= 0
        ? "Agotado en esta talla"
        : "Agregar a la bolsa";
  const disabled = soldOut || (!needsSize && stock <= 0);
  const sizeGuide = shop.pages.find((p) => p.slug === "guia-de-tallas");
  const returns = shop.pages.find((p) => p.slug === "envios-y-cambios");
  const details = product.details.split("\n").map((l) => l.trim()).filter(Boolean);
  const perks = shop.settings.home.perks;

  return (
    <>
      <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(380px,1fr)]">
        <Gallery images={images} alt={`${product.name}${color ? ` ${color}` : ""}`} onOpen={setZoom} />

        <div className="edge lg:px-[clamp(32px,4vw,72px)]">
          <div className="pb-10 pt-8 lg:sticky lg:top-[76px] lg:pt-14">
            <nav aria-label="Ruta" className="text-[13px] text-ink-3">
              <Link href="/tienda" className="hover:text-ink">
                Tienda
              </Link>
              {product.category && (
                <>
                  <span className="mx-2">•</span>
                  <Link href={`/categoria/${product.category.slug}`} className="hover:text-ink">
                    {product.category.name}
                  </Link>
                </>
              )}
            </nav>

            <h1 className="caps mt-6 !text-[15px] !tracking-[0.16em]">{product.name}</h1>
            <Price price={product.price} compareAt={product.compareAtPrice} className="mt-2 text-[15px]" />
            {product.tagline && <p className="mt-4 max-w-[42ch] text-[14px] text-ink-2">{product.tagline}</p>}

            {hasColors && (
              <fieldset className="mt-9">
                <legend className="text-[13px]">
                  <span className="text-ink-3">Color </span>
                  {color}
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      aria-label={c.name}
                      aria-pressed={c.name === color}
                      title={colorStock(c.name) > 0 ? c.name : `${c.name}, agotado`}
                      onClick={() => setColor(c.name)}
                      className={cx(
                        "relative p-[3px] transition-shadow duration-200",
                        c.name === color ? "shadow-[0_0_0_1px_var(--c-ink)]" : "hover:shadow-[0_0_0_1px_var(--c-line)]",
                      )}
                    >
                      <span className="block size-7 shadow-[inset_0_0_0_1px_rgba(128,128,128,0.35)]" style={{ background: c.hex }} />
                      {colorStock(c.name) <= 0 && (
                        <span className="absolute inset-0 grid place-items-center" aria-hidden>
                          <span className="h-px w-9 rotate-45 bg-ink-2" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {hasSizes && (
              <fieldset className="mt-8">
                <div className="flex items-baseline justify-between">
                  <legend className="float-left text-[13px]">
                    <span className="text-ink-3">Talla </span>
                    {size}
                  </legend>
                  {sizeGuide && (
                    <Link href={`/${sizeGuide.slug}`} className="link text-[13px] text-ink-2">
                      Guía de tallas
                    </Link>
                  )}
                </div>
                <div className="clear-both mt-3 grid grid-cols-5 gap-px border border-line bg-line">
                  {product.sizes.map((s) => {
                    const available = stockOf(color, s) > 0;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!available}
                        aria-pressed={s === size}
                        onClick={() => {
                          setSize(s);
                          setAskSize(false);
                        }}
                        className={cx(
                          "h-12 text-[13px] transition-colors duration-150",
                          s === size
                            ? "bg-ink text-paper"
                            : available
                              ? "bg-paper hover:bg-mist"
                              : "bg-paper text-ink-3 line-through decoration-1",
                        )}
                      >
                        {s}
                        {!available && <span className="sr-only">, agotada</span>}
                      </button>
                    );
                  })}
                </div>
                {askSize && <p className="mt-2.5 text-[13px] text-bad">Elige una talla para agregarlo a la bolsa.</p>}
              </fieldset>
            )}

            <div ref={buyRef} className="mt-8">
              <Button size="lg" className="caps h-14 w-full !text-[12px]" disabled={disabled} onClick={add}>
                {label}
              </Button>
              {!needsSize && stock > 0 && stock <= 5 && (
                <p className="mt-3 text-[13px] text-ink-2">
                  {stock === 1 ? "Queda la última unidad." : `Quedan ${stock} unidades.`}
                </p>
              )}
            </div>

            <div className="mt-10 border-b border-line">
              {product.description && (
                <Accordion title="Descripción" open>
                  {product.description.split(/\n{2,}/).map((para, i) => (
                    <p key={i} className={i ? "mt-3" : undefined}>
                      {para}
                    </p>
                  ))}
                </Accordion>
              )}
              {details.length > 0 && (
                <Accordion title="Materiales y cuidado">
                  <ul className="space-y-1">
                    {details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Accordion>
              )}
              <Accordion title="Envíos y cambios">
                {perks.length > 0 ? (
                  <ul className="space-y-1">
                    {perks.map((p, i) => (
                      <li key={i}>
                        <span className="text-ink">{p.title}.</span> {p.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Los métodos de envío, con su costo y tiempo de entrega, aparecen antes de pagar.</p>
                )}
                {returns && (
                  <p className="mt-3">
                    <Link href={`/${returns.slug}`} className="link text-ink">
                      Leer la política completa
                    </Link>
                  </p>
                )}
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {zoom !== null && <Lightbox images={images} start={zoom} onClose={() => setZoom(null)} />}
      </AnimatePresence>

      {/* Barra de compra fija en el celular cuando el botón sale de la vista */}
      <AnimatePresence>
        {barVisible && !soldOut && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper lg:hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className="edge flex items-center gap-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="caps block truncate !text-[11px]">{product.name}</span>
                <span className="block text-[13px] text-ink-2 tabular-nums">
                  {[color, size].filter(Boolean).join(" · ") || money(product.price)}
                </span>
              </span>
              <Button className="caps !text-[11px]" disabled={disabled} onClick={add}>
                {needsSize ? "Elegir talla" : stock <= 0 ? "Agotado" : "Agregar"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.store.product.useQuery({ slug: slug ?? "" });

  if (isLoading) {
    return (
      <div className="grid h-[80svh] place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="edge pt-24">
        <EmptyState title="Este producto ya no está disponible" text="Puede que se haya agotado o que lo hayamos retirado de la tienda.">
          <ButtonLink href="/tienda">Ver toda la tienda</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <Buy key={data.product.id} product={data.product} />
      {data.related.length > 0 && (
        <section className="pt-24 sm:pt-32" aria-labelledby="relacionados">
          <h2 id="relacionados" className="caps edge mb-6">
            También te puede gustar
          </h2>
          <div className="edge">
            <ProductGrid products={data.related} />
          </div>
        </section>
      )}
    </div>
  );
}
