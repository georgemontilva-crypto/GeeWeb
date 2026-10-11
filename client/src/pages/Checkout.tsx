import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMoney } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { useCartDetails } from "@/lib/useCartDetails";
import { Button, ButtonLink, EmptyState, Field, Input, Spinner, Textarea, cx, toastError } from "@/components/ui";
import { CartLineRow } from "@/components/CartDrawer";

const FORM_KEY = "gee.checkout.v1";
const EMPTY = {
  name: "",
  email: "",
  phone: "",
  document: "",
  address: "",
  addressExtra: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  notes: "",
};
type Form = typeof EMPTY;

function loadForm(): Form {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(FORM_KEY) ?? "{}"), notes: "" };
  } catch {
    return EMPTY;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="text-[24px] tracking-[-0.03em]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  text,
  aside,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  text?: string;
  aside?: ReactNode;
  name: string;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-4 rounded-[18px] bg-white px-5 py-4 transition-shadow duration-150",
        selected
          ? "shadow-[0_0_0_2px_var(--color-ink)]"
          : "shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1.5px_var(--color-ink-3)]",
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={cx(
          "grid size-[22px] shrink-0 place-items-center rounded-full transition-colors",
          selected ? "bg-ink text-white" : "shadow-[inset_0_0_0_1.5px_var(--color-line)]",
        )}
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold tracking-[-0.02em]">{title}</span>
        {text && <span className="block text-[14px] leading-snug text-ink-2">{text}</span>}
      </span>
      {aside && <span className="shrink-0 text-[15px] tabular-nums">{aside}</span>}
    </label>
  );
}

export default function Checkout() {
  const money = useMoney();
  const [, navigate] = useLocation();
  const { rows, subtotal, loading, hasProblems, refetch } = useCartDetails();
  const options = trpc.store.checkoutOptions.useQuery();

  const [form, setForm] = useState<Form>(loadForm);
  const [errors, setErrors] = useState<Partial<Record<keyof Form | "shipping" | "payment", string>>>({});
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [couponText, setCouponText] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; type: string; value: number } | null>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({ ...form, notes: "" }));
    } catch {
      /* almacenamiento bloqueado */
    }
  }, [form]);

  // Preselecciona la primera opción de envío y de pago.
  useEffect(() => {
    if (!options.data) return;
    setShippingId((cur) => cur ?? options.data.shipping[0]?.id ?? null);
    setPaymentId((cur) => cur ?? options.data.payment[0]?.id ?? null);
  }, [options.data]);

  const discount = useMemo(() => {
    if (!coupon) return 0;
    return coupon.type === "porcentaje"
      ? Math.round((subtotal * Math.min(100, coupon.value)) / 100)
      : Math.min(subtotal, coupon.value);
  }, [coupon, subtotal]);

  const shipCost = (s: { price: number; freeOver: number | null }) =>
    s.freeOver !== null && subtotal - discount >= s.freeOver ? 0 : s.price;
  const shipping = options.data?.shipping.find((s) => s.id === shippingId);
  const shippingCost = shipping ? shipCost(shipping) : 0;
  const total = Math.max(0, subtotal - discount) + shippingCost;

  const applyCoupon = trpc.store.coupon.useMutation({
    onSuccess: (c) => {
      setCoupon({ code: c.code, type: c.type, value: c.value });
      setCouponText("");
    },
    onError: toastError,
  });

  const create = trpc.store.createOrder.useMutation({
    onSuccess: ({ token }) => {
      setPlaced(true);
      cart.clear();
      navigate(`/pedido/${token}?nuevo=1`);
    },
    onError: (err) => {
      toastError(err);
      void refetch();
    },
  });

  const set = (key: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 3) next.name = "Escribe tu nombre completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Escribe un correo válido.";
    if (form.phone.trim().length < 6) next.phone = "Escribe un teléfono de contacto.";
    if (form.address.trim().length < 4) next.address = "Escribe la dirección de entrega.";
    if (form.city.trim().length < 2) next.city = "Escribe la ciudad.";
    if (!shippingId) next.shipping = "Elige un método de envío.";
    if (!paymentId) next.payment = "Elige un método de pago.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`campo-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    create.mutate({
      items: rows.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
      customer: { ...form, email: form.email.trim() },
      shippingMethodId: shippingId!,
      paymentMethodId: paymentId!,
      couponCode: coupon?.code ?? "",
    });
  };

  if (loading || options.isLoading) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (rows.length === 0 && !placed) {
    return (
      <div className="wrap pt-[160px]">
        <EmptyState title="Tu bolsa está vacía" text="Agrega algo antes de finalizar la compra.">
          <ButtonLink href="/tienda">Ir a la tienda</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="wrap pt-[116px]">
      <h1 className="headline text-[clamp(2.4rem,6vw,4.5rem)]">Finalizar compra</h1>

      <form onSubmit={submit} noValidate className="mt-10 grid items-start gap-x-[5vw] gap-y-10 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-10">
          <Section title="Tus datos">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre completo" error={errors.name} className="sm:col-span-2">
                <Input id="campo-name" autoComplete="name" value={form.name} onChange={set("name")} />
              </Field>
              <Field label="Correo" error={errors.email} hint="Aquí te enviamos la confirmación y el seguimiento.">
                <Input id="campo-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} />
              </Field>
              <Field label="Teléfono" error={errors.phone}>
                <Input id="campo-phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set("phone")} />
              </Field>
              <Field label="Documento" optional className="sm:col-span-2">
                <Input value={form.document} onChange={set("document")} />
              </Field>
            </div>
          </Section>

          <Section title="Entrega">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Dirección" error={errors.address} className="sm:col-span-2">
                <Input id="campo-address" autoComplete="address-line1" value={form.address} onChange={set("address")} />
              </Field>
              <Field label="Apartamento, torre, barrio" optional className="sm:col-span-2">
                <Input autoComplete="address-line2" value={form.addressExtra} onChange={set("addressExtra")} />
              </Field>
              <Field label="Ciudad" error={errors.city}>
                <Input id="campo-city" autoComplete="address-level2" value={form.city} onChange={set("city")} />
              </Field>
              <Field label="Departamento o estado" optional>
                <Input autoComplete="address-level1" value={form.region} onChange={set("region")} />
              </Field>
              <Field label="País" optional>
                <Input autoComplete="country-name" value={form.country} onChange={set("country")} />
              </Field>
              <Field label="Código postal" optional>
                <Input autoComplete="postal-code" value={form.postalCode} onChange={set("postalCode")} />
              </Field>
            </div>
          </Section>

          <Section title="Envío">
            <div id="campo-shipping" className="space-y-3" role="radiogroup" aria-label="Método de envío">
              {options.data?.shipping.length === 0 && (
                <p className="text-[15px] text-ink-2">Por ahora no hay métodos de envío disponibles. Escríbenos para coordinar tu pedido.</p>
              )}
              {options.data?.shipping.map((s) => {
                const cost = shipCost(s);
                return (
                  <OptionCard
                    key={s.id}
                    name="envio"
                    selected={s.id === shippingId}
                    onSelect={() => setShippingId(s.id)}
                    title={s.name}
                    text={[s.eta, s.description].filter(Boolean).join(". ")}
                    aside={cost === 0 ? "Gratis" : money(cost)}
                  />
                );
              })}
              {errors.shipping && <p className="text-[14px] text-bad">{errors.shipping}</p>}
            </div>
          </Section>

          <Section title="Pago">
            <div id="campo-payment" className="space-y-3" role="radiogroup" aria-label="Método de pago">
              {options.data?.payment.length === 0 && (
                <p className="text-[15px] text-ink-2">Por ahora no hay métodos de pago disponibles. Escríbenos para coordinar tu pedido.</p>
              )}
              {options.data?.payment.map((p) => (
                <OptionCard
                  key={p.id}
                  name="pago"
                  selected={p.id === paymentId}
                  onSelect={() => setPaymentId(p.id)}
                  title={p.name}
                  text={p.description}
                />
              ))}
              {errors.payment && <p className="text-[14px] text-bad">{errors.payment}</p>}
              <p className="pt-1 text-[14px] text-ink-2">
                Al confirmar verás los datos para pagar. Despachamos cuando el pago esté confirmado.
              </p>
            </div>
          </Section>

          <Section title="Notas del pedido">
            <Field optional label="Algo que debamos saber para la entrega">
              <Textarea rows={3} value={form.notes} onChange={set("notes")} maxLength={1000} />
            </Field>
          </Section>
        </div>

        <aside className="rounded-card bg-mist p-6 sm:p-7 lg:sticky lg:top-[84px]" aria-label="Resumen del pedido">
          <h2 className="text-[21px] tracking-[-0.03em]">Tu pedido</h2>
          <ul className="mt-2 divide-y divide-black/8 [&_.bg-mist]:bg-white">
            {rows.map((r) => (
              <CartLineRow key={r.variantId} row={r} compact />
            ))}
          </ul>

          <div className="mt-2 border-t border-black/8 pt-5">
            {coupon ? (
              <div className="flex items-center justify-between rounded-[14px] bg-white px-4 py-3 text-[15px]">
                <span>
                  Cupón <strong className="font-semibold">{coupon.code}</strong> aplicado
                </span>
                <button
                  type="button"
                  onClick={() => setCoupon(null)}
                  className="text-[14px] text-ink-2 underline underline-offset-4 hover:text-ink"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  aria-label="Código de cupón"
                  placeholder="Código de cupón"
                  value={couponText}
                  onChange={(e) => setCouponText(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (couponText.trim()) applyCoupon.mutate({ code: couponText, subtotal });
                    }
                  }}
                  className="border-transparent"
                />
                <Button
                  variant="secondary"
                  className="h-12 !bg-white"
                  loading={applyCoupon.isPending}
                  disabled={!couponText.trim()}
                  onClick={() => applyCoupon.mutate({ code: couponText, subtotal })}
                >
                  Aplicar
                </Button>
              </div>
            )}
          </div>

          <dl className="mt-5 space-y-2 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-2">Descuento</dt>
                <dd className="tabular-nums text-good">−{money(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-2">Envío</dt>
              <dd className="tabular-nums">{!shipping ? "Por definir" : shippingCost === 0 ? "Gratis" : money(shippingCost)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-black/8 pt-4">
              <dt className="text-[17px] font-semibold">Total</dt>
              <dd className="text-[26px] font-semibold tracking-[-0.03em] tabular-nums">{money(total)}</dd>
            </div>
          </dl>

          <Button type="submit" size="lg" className="mt-6 w-full" loading={create.isPending} disabled={hasProblems || rows.length === 0}>
            Confirmar pedido
          </Button>
          {hasProblems && (
            <p className="mt-3 text-[14px] text-bad">Ajusta los artículos marcados en rojo para continuar.</p>
          )}
        </aside>
      </form>
    </div>
  );
}
