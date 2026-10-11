import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link, useParams, useSearch } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMoney, useShop, type ProductDetail } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { Button, ButtonLink, EmptyState, Spinner, cx } from "@/components/ui";
import { Price, ProductGrid, Swatch } from "@/components/ProductCard";
import { QuantityStepper } from "@/components/CartDrawer";

const EASE = [0.28, 0.11, 0.32, 1] as const;
const PERK_ICONS = [Truck, RefreshCw, ShieldCheck];
const tint = (hex: string, amount = 10) => `color-mix(in srgb, ${hex} ${amount}%, #f5f5f7)`;

function Gallery({ images, alt, hex }: { images: string[]; alt: string; hex?: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => setIndex(0), [images]);
  const current = images[index] ?? images[0];

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div>
      <div
        className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-[36px] bg-mist transition-[background-color] duration-700 ease-apple"
        style={{ backgroundColor: hex ? tint(hex) : undefined }}
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
      >
        <AnimatePresence initial={false}>
          {current && (
            <motion.img
              key={current}
              src={current}
              alt={alt}
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: zoom ? 1.75 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: zoom ? 0.25 : 0.5, ease: EASE }}
              style={{ transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "50% 50%" }}
              fetchPriority="high"
            />
          )}
        </AnimatePresence>
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3" role="group" aria-label="Fotos del producto">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cx(
                "h-[92px] w-[74px] overflow-hidden rounded-[18px] bg-mist transition-shadow duration-200",
                i === index ? "shadow-[0_0_0_2px_var(--color-ink)]" : "hover:shadow-[0_0_0_2px_var(--color-line)]",
              )}
              style={{ backgroundColor: hex ? tint(hex) : undefined }}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Accordion({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-t border-line" open={open}>
      <summary className="flex list-none items-center justify-between gap-4 py-5 text-[19px] font-semibold tracking-[-0.02em] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-5 shrink-0 text-ink-2 transition-transform duration-300 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-6 text-[16px] leading-relaxed text-ink-2">{children}</div>
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
  const [size, setSize] = useState(hasSizes ? "" : "");
  const [qty, setQty] = useState(1);
  const [askSize, setAskSize] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialColor && product.colors.some((c) => c.name === initialColor)) setColor(initialColor);
  }, [initialColor, product.colors]);

  // Si la talla elegida no existe en el nuevo color, se limpia la selección.
  useEffect(() => {
    if (size && stockOf(color, size) <= 0) setSize("");
    setQty(1);
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
  const hex = product.colors.find((c) => c.name === color)?.hex;

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
    cart.add(variant.id, Math.min(qty, stock));
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
      <div className="grid gap-x-[5vw] gap-y-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-[84px] lg:self-start">
          <Gallery images={images} alt={`${product.name}${color ? ` ${color}` : ""}`} hex={hex} />
        </div>

        <div className="lg:py-4">
          <nav aria-label="Ruta" className="text-[14px] text-ink-2">
            <Link href="/tienda" className="hover:text-ink">
              Tienda
            </Link>
            {product.category && (
              <>
                <span className="mx-2 text-ink-3">/</span>
                <Link href={`/categoria/${product.category.slug}`} className="hover:text-ink">
                  {product.category.name}
                </Link>
              </>
            )}
          </nav>

          {product.isNew && <p className="mt-5 text-[15px] font-medium text-[#b4530a]">Nuevo</p>}
          <h1 className="headline mt-2 text-[clamp(2.4rem,4.6vw,4rem)]">{product.name}</h1>
          {product.tagline && <p className="mt-3 text-[19px] text-ink-2">{product.tagline}</p>}
          <Price
            price={product.price}
            compareAt={product.compareAtPrice}
            className="mt-5 text-[24px] font-semibold tracking-[-0.02em]"
          />

          {hasColors && (
            <fieldset className="mt-9">
              <legend className="text-[15px]">
                <span className="text-ink-2">Color: </span>
                <span className="font-semibold">{color}</span>
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
                      "relative rounded-full p-1 transition-shadow duration-200",
                      c.name === color
                        ? "shadow-[0_0_0_2px_var(--color-ink)]"
                        : "shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_2px_var(--color-ink-3)]",
                    )}
                  >
                    <span
                      className="block size-8 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
                      style={{ background: c.hex }}
                    />
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
                <legend className="float-left text-[15px]">
                  <span className="text-ink-2">Talla{size ? ": " : ""}</span>
                  <span className="font-semibold">{size}</span>
                </legend>
                {sizeGuide && (
                  <Link
                    href={`/${sizeGuide.slug}`}
                    className="text-[14px] text-ink-2 underline underline-offset-4 hover:text-ink"
                  >
                    Guía de tallas
                  </Link>
                )}
              </div>
              <div className="mt-3 grid clear-both grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
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
                        setQty(1);
                      }}
                      className={cx(
                        "relative h-14 overflow-hidden rounded-[16px] text-[16px] font-medium transition-[box-shadow,background-color] duration-150",
                        s === size
                          ? "bg-white shadow-[0_0_0_2px_var(--color-ink)]"
                          : available
                            ? "bg-white shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1.5px_var(--color-ink-3)]"
                            : "bg-mist text-ink-3 shadow-none",
                      )}
                    >
                      {s}
                      {!available && (
                        <span className="sr-only">, agotada</span>
                      )}
                      {!available && (
                        <span aria-hidden className="absolute inset-0 grid place-items-center">
                          <span className="h-px w-[130%] -rotate-[24deg] bg-line" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {askSize && <p className="mt-2.5 text-[14px] text-bad">Elige una talla para agregarlo a la bolsa.</p>}
            </fieldset>
          )}

          <div ref={buyRef} className="mt-9 flex items-center gap-3">
            {!soldOut && (
              <QuantityStepper value={qty} max={needsSize ? 20 : Math.max(1, Math.min(20, stock))} onChange={setQty} />
            )}
            <Button size="lg" className="flex-1" disabled={disabled} onClick={add}>
              {label}
            </Button>
          </div>
          {!needsSize && stock > 0 && stock <= 5 && (
            <p className="mt-3 text-[14px] text-warn">
              {stock === 1 ? "Queda la última unidad." : `Quedan solo ${stock} unidades.`}
            </p>
          )}

          {perks.length > 0 && (
            <ul className="mt-9 space-y-3.5 text-[15px]">
              {perks.map((perk, i) => {
                const Icon = PERK_ICONS[i % PERK_ICONS.length]!;
                return (
                  <li key={i} className="flex items-start gap-3 text-ink-2">
                    <Icon className="mt-0.5 size-5 shrink-0 text-ink" strokeWidth={1.6} aria-hidden />
                    <span>
                      <span className="font-medium text-ink">{perk.title}.</span> {perk.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

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
                <ul className="space-y-1.5">
                  {details.map((d) => (
                    <li key={d} className="flex gap-3">
                      <span className="mt-[0.7em] size-1 shrink-0 rounded-full bg-ink-3" aria-hidden />
                      {d}
                    </li>
                  ))}
                </ul>
              </Accordion>
            )}
            <Accordion title="Envíos y cambios">
              <p>Los métodos de envío, con su costo y tiempo de entrega, aparecen antes de pagar.</p>
              {returns && (
                <p className="mt-3">
                  <Link href={`/${returns.slug}`} className="text-ink underline underline-offset-4">
                    Leer la política completa
                  </Link>
                </p>
              )}
            </Accordion>
          </div>
        </div>
      </div>

      {/* Barra de compra fija: aparece cuando el botón principal sale de la vista */}
      <AnimatePresence>
        {barVisible && !soldOut && (
          <motion.div
            className="fixed inset-x-3 bottom-3 z-40"
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="glass mx-auto flex max-w-[760px] items-center gap-4 rounded-full py-2 pl-3 pr-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.3)]">
              <span className="size-11 shrink-0 overflow-hidden rounded-full bg-mist">
                {images[0] && <img src={images[0]} alt="" className="size-full scale-[1.6] object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold tracking-[-0.02em]">{product.name}</span>
                <span className="block truncate text-[13px] text-ink-2">
                  {[color, size].filter(Boolean).join(", ") || money(product.price)}
                </span>
              </span>
              <span className="hidden text-[15px] tabular-nums sm:block">{money(product.price)}</span>
              <Button disabled={disabled} onClick={add}>
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
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="wrap pt-[160px]">
        <EmptyState title="Este producto ya no está disponible" text="Puede que se haya agotado o que lo hayamos retirado de la tienda.">
          <ButtonLink href="/tienda">Ver toda la tienda</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="wrap pt-[92px]">
      <Buy key={data.product.id} product={data.product} />
      {data.related.length > 0 && (
        <section className="pt-28 sm:pt-36" aria-labelledby="relacionados">
          <h2 id="relacionados" className="headline text-[clamp(2rem,4.4vw,3.5rem)]">
            Combina con esto.
          </h2>
          <div className="mt-9">
            <ProductGrid products={data.related} />
          </div>
        </section>
      )}
    </div>
  );
}
