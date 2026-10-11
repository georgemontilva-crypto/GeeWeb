import { useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import { Check, FileUp } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_TRACK_STEPS, formatMoney, type OrderStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { Button, ButtonLink, EmptyState, Spinner, cx, toast, toastError, uploadFile } from "@/components/ui";

const STEP_SHORT: Record<OrderStatus, string> = {
  pendiente: "Recibido",
  pagado: "Pago confirmado",
  preparando: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function Steps({ status }: { status: OrderStatus }) {
  const current = ORDER_TRACK_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1 sm:gap-2" aria-label="Estado del pedido">
      {ORDER_TRACK_STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s} aria-current={i === current ? "step" : undefined}>
            <div className={cx("h-1.5 rounded-full transition-colors", done ? "bg-ink" : "bg-mist-2")} />
            <p className={cx("mt-3 text-[12px] leading-tight sm:text-[14px]", done ? "font-medium text-ink" : "text-ink-3")}>
              {STEP_SHORT[s]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export default function Order() {
  const shop = useShop()!;
  const { token } = useParams<{ token: string }>();
  const isNew = new URLSearchParams(useSearch()).get("nuevo") === "1";
  const q = trpc.store.order.useQuery({ token: token ?? "" }, { refetchOnWindowFocus: true });
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  if (q.isLoading) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  const o = q.data;
  if (!o) {
    return (
      <div className="wrap pt-[160px]">
        <EmptyState title="No encontramos ese pedido" text="Revisa el enlace o búscalo con tu número de pedido y tu correo.">
          <ButtonLink href="/seguimiento">Buscar mi pedido</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  const money = (c: number) => formatMoney(c, o.currency, shop.settings.locale);
  const firstName = o.customerName.split(" ")[0];
  const cancelled = o.status === "cancelado";
  const pending = o.status === "pendiente";
  const isPdf = o.paymentProofUrl.toLowerCase().endsWith(".pdf");

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      await uploadFile(f, "/api/upload/comprobante", { token: o.token });
      toast("Comprobante enviado");
      await q.refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="wrap max-w-[1040px] pt-[116px]">
      <header>
        <p className="text-[17px] text-ink-2">Pedido {o.number}</p>
        <h1 className="headline mt-2 text-[clamp(2.4rem,6vw,4.5rem)]">
          {cancelled
            ? "Este pedido fue cancelado."
            : isNew
              ? `Gracias, ${firstName}.`
              : ORDER_STATUS_LABEL[o.status] + "."}
        </h1>
        <p className="mt-4 max-w-[56ch] text-[19px] text-ink-2">
          {cancelled
            ? "Si crees que es un error, escríbenos con tu número de pedido."
            : isNew
              ? `Recibimos tu pedido. Te enviamos la confirmación a ${o.customerEmail}.`
              : `Hecho el ${fmtDate(o.createdAt)}.`}
        </p>
      </header>

      {!cancelled && (
        <div className="mt-10">
          <Steps status={o.status} />
        </div>
      )}

      <div className="mt-12 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {pending && (
            <section className="rounded-card bg-mist p-6 sm:p-8" aria-labelledby="pago">
              <h2 id="pago" className="text-[24px] tracking-[-0.03em]">
                {o.paymentRequiresProof ? "Paga y sube tu comprobante" : "Cómo vas a pagar"}
              </h2>
              <p className="mt-2 text-[16px] text-ink-2">
                {o.paymentMethod}. Total a pagar: <strong className="font-semibold text-ink">{money(o.total)}</strong>
              </p>
              {o.paymentInstructions && (
                <p className="mt-5 whitespace-pre-line rounded-[18px] bg-white p-5 text-[15px] leading-relaxed">
                  {o.paymentInstructions}
                </p>
              )}
              {o.paymentRequiresProof && (
                <div className="mt-5">
                  <input
                    ref={file}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      void onFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {o.paymentProofUrl ? (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                      <p className="flex items-center gap-2.5 text-[16px] font-medium">
                        <span className="grid size-6 place-items-center rounded-full bg-good text-white">
                          <Check className="size-3.5" strokeWidth={3} aria-hidden />
                        </span>
                        Recibimos tu comprobante
                      </p>
                      <a
                        href={o.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[15px] text-ink-2 underline underline-offset-4 hover:text-ink"
                      >
                        {isPdf ? "Abrir el PDF" : "Ver la imagen"}
                      </a>
                      <button
                        type="button"
                        onClick={() => file.current?.click()}
                        className="text-[15px] text-ink-2 underline underline-offset-4 hover:text-ink"
                      >
                        Cambiar el archivo
                      </button>
                      <p className="w-full text-[14px] text-ink-2">Lo revisamos y te avisamos por correo cuando el pago esté confirmado.</p>
                    </div>
                  ) : (
                    <>
                      <Button size="lg" loading={uploading} onClick={() => file.current?.click()}>
                        {!uploading && <FileUp className="size-[18px]" aria-hidden />}
                        Subir comprobante
                      </Button>
                      <p className="mt-3 text-[14px] text-ink-2">Foto o PDF, hasta 12 MB. Puedes volver a esta página cuando quieras.</p>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {o.trackingNumber && (
            <section className="rounded-card bg-mist p-6 sm:p-8" aria-labelledby="guia">
              <h2 id="guia" className="text-[24px] tracking-[-0.03em]">
                Tu envío
              </h2>
              <p className="mt-2 text-[16px] text-ink-2">
                {o.shippingMethod}. Número de guía: <strong className="font-semibold text-ink">{o.trackingNumber}</strong>
              </p>
              {o.trackingUrl && (
                <div className="mt-5">
                  <ButtonLink href={o.trackingUrl} external>
                    Rastrear el envío
                  </ButtonLink>
                </div>
              )}
            </section>
          )}

          <section className="rounded-card p-6 shadow-[inset_0_0_0_1px_var(--color-mist-2)] sm:p-8" aria-labelledby="articulos">
            <h2 id="articulos" className="text-[24px] tracking-[-0.03em]">
              Lo que pediste
            </h2>
            <ul className="mt-3 divide-y divide-mist-2">
              {o.items.map((i, n) => (
                <li key={n} className="flex items-center gap-4 py-4">
                  <span className="h-[84px] w-[68px] shrink-0 overflow-hidden rounded-[16px] bg-mist">
                    {i.imageUrl && <img src={i.imageUrl} alt="" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold tracking-[-0.02em]">{i.name}</span>
                    <span className="block text-[14px] text-ink-2">
                      {[i.color, i.size].filter(Boolean).join(", ")}
                      {i.color || i.size ? ". " : ""}Cantidad: {i.quantity}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums">{money(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-2 border-t border-mist-2 pt-5 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="tabular-nums">{money(o.subtotal)}</dd>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">Descuento {o.couponCode}</dt>
                  <dd className="tabular-nums text-good">−{money(o.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-2">Envío</dt>
                <dd className="tabular-nums">{o.shippingCost === 0 ? "Gratis" : money(o.shippingCost)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <dt className="text-[17px] font-semibold">Total</dt>
                <dd className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums">{money(o.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-card bg-mist p-6">
            <h2 className="text-[19px] tracking-[-0.02em]">Entrega</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {o.customerName}
              <br />
              {o.address}
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              <span className="font-medium text-ink">{o.shippingMethod}</span>
              {o.shippingEta && (
                <>
                  <br />
                  {o.shippingEta}
                </>
              )}
            </p>
          </section>

          <section className="rounded-card bg-mist p-6">
            <h2 className="text-[19px] tracking-[-0.02em]">Historial</h2>
            <ol className="mt-3 space-y-3.5">
              {[...o.events].reverse().map((e, i) => (
                <li key={i} className="text-[15px] leading-snug">
                  <span className="font-medium">{e.note || ORDER_STATUS_LABEL[e.status as OrderStatus] || e.status}</span>
                  <span className="block text-[13px] text-ink-2">{fmtDate(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>

          <ButtonLink href="/tienda" variant="secondary" className="w-full">
            Seguir comprando
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
