import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { cart, useCart } from "@/lib/cart";
import { useCartDetails, type CartRow } from "@/lib/useCartDetails";
import { useMoney } from "@/lib/shop";
import { trpc } from "@/lib/trpc";
import { Button, IconButton, Spinner, cx } from "./ui";

export function QuantityStepper({
  value,
  max,
  onChange,
  small,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  small?: boolean;
}) {
  const b = cx(
    "grid place-items-center text-ink transition-colors hover:bg-mist disabled:opacity-30",
    small ? "size-7" : "size-9",
  );
  return (
    <div className={cx("inline-flex items-center border border-line", small ? "gap-1 p-0.5" : "gap-1.5 p-1")}>
      <button type="button" className={b} aria-label="Quitar una unidad" onClick={() => onChange(value - 1)} disabled={value <= 1}>
        <Minus className="size-3.5" />
      </button>
      <span className={cx("min-w-5 text-center font-medium tabular-nums", small ? "text-[14px]" : "text-[15px]")} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={b}
        aria-label="Agregar una unidad"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function CartLineRow({ row, compact }: { row: CartRow; compact?: boolean }) {
  const money = useMoney();
  const variant = [row.color, row.size].filter(Boolean).join(", ");
  return (
    <li className="flex gap-4 py-4">
      <Link
        href={`/producto/${row.slug}`}
        onClick={() => cart.close()}
        className={cx("shrink-0 overflow-hidden bg-tile", compact ? "h-[95px] w-[76px]" : "h-[130px] w-[104px]")}
      >
        {row.imageUrl && <img src={row.imageUrl} alt="" className="size-full object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="caps truncate !text-[11px]">{row.name}</p>
            {variant && <p className="mt-1 text-[13px] text-ink-2">{variant}</p>}
          </div>
          <p className="shrink-0 text-[13px] tabular-nums">{money(row.price * row.quantity)}</p>
        </div>
        {row.problem && (
          <p className="mt-1 text-[13px] text-bad">
            {row.available <= 0 ? "Se agotó. Quítalo para continuar." : `Solo quedan ${row.available}. Ajusta la cantidad.`}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <QuantityStepper
            small
            value={row.quantity}
            max={Math.max(row.quantity, Math.min(20, row.available))}
            onChange={(n) => cart.setQuantity(row.variantId, n)}
          />
          <button
            type="button"
            onClick={() => cart.remove(row.variantId)}
            className="link text-[12px] text-ink-2"
          >
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}

/** Cuánto falta para el envío gratis más cercano, si alguno lo ofrece. */
export function useFreeShipping(subtotal: number) {
  const { data } = trpc.store.checkoutOptions.useQuery(undefined, { staleTime: 5 * 60_000 });
  const thresholds = (data?.shipping ?? []).flatMap((s) => (s.freeOver !== null && s.price > 0 ? [s.freeOver] : []));
  if (thresholds.length === 0) return null;
  const goal = Math.min(...thresholds);
  return { goal, missing: Math.max(0, goal - subtotal), progress: Math.min(1, subtotal / goal) };
}

export function CartDrawer() {
  const { open, count } = useCart();
  const { rows, subtotal, loading, hasProblems } = useCartDetails();
  const money = useMoney();
  const free = useFreeShipping(subtotal);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => cart.close()}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Tu bolsa"
            className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-line bg-paper"
            initial={{ x: "104%" }}
            animate={{ x: 0 }}
            exit={{ x: "104%" }}
            transition={{ duration: 0.45, ease: [0.28, 0.11, 0.32, 1] }}
          >
            <header className="flex h-16 items-center justify-between border-b border-line px-6 sm:h-[76px]">
              <h2 className="caps">
                Tu bolsa{count > 0 && <span className="ml-2 text-ink-3">({count})</span>}
              </h2>
              <IconButton label="Cerrar la bolsa" onClick={() => cart.close()} className="-mr-2">
                <X className="size-5" strokeWidth={1.2} />
              </IconButton>
            </header>

            {loading ? (
              <div className="grid flex-1 place-items-center">
                <Spinner />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <p className="caps">Tu bolsa está vacía</p>
                <p className="mt-2 text-[14px] text-ink-2">Agrega algo que te guste y lo verás aquí.</p>
                <Button
                  className="mt-6"
                  onClick={() => {
                    cart.close();
                    navigate("/tienda");
                  }}
                >
                  Ir a la tienda
                </Button>
              </div>
            ) : (
              <>
                {free && (
                  <div className="mx-6 mt-5 border border-line px-4 py-3">
                    <p className="text-[13px]">
                      {free.missing > 0 ? (
                        <>
                          Te faltan <strong className="font-medium">{money(free.missing)}</strong> para el envío gratis.
                        </>
                      ) : (
                        <strong className="font-medium">Tienes envío gratis.</strong>
                      )}
                    </p>
                    <div className="mt-2 h-px overflow-hidden bg-line">
                      <div
                        className="h-full bg-ink transition-[width] duration-500 ease-apple"
                        style={{ width: `${free.progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-6">
                  {rows.map((r) => (
                    <CartLineRow key={r.variantId} row={r} />
                  ))}
                </ul>
                <footer className="border-t border-line px-6 pb-6 pt-5">
                  <div className="flex items-baseline justify-between">
                    <span className="caps">Subtotal</span>
                    <span className="text-[15px] tabular-nums">{money(subtotal)}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-3">El envío se calcula en el siguiente paso.</p>
                  <Button
                    size="lg"
                    className="caps mt-5 h-14 w-full !text-[12px]"
                    disabled={hasProblems}
                    onClick={() => {
                      cart.close();
                      navigate("/checkout");
                    }}
                  >
                    Finalizar compra
                  </Button>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
