import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Search } from "lucide-react";
import { formatMoney } from "@shared/types";
import { Button, ButtonLink, EmptyState, IconButton, ImageField, Input, Spinner, cx } from "@/components/ui";
import { useShop } from "@/lib/shop";

/* ───────────── Estructura de página ───────────── */

export function PageHeader({
  title,
  description,
  actions,
  back,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 mb-3 inline-flex items-center gap-1.5 rounded-full px-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold">{title}</h1>
          {description && <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-[24px] bg-white p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            {title && <h2 className="text-[19px] font-semibold">{title}</h2>}
            {description && <p className="mt-1.5 max-w-[62ch] text-[14px] leading-snug text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Aviso tranquilo, sin alarma: para recomendaciones de configuración. */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[20px] bg-white px-5 py-4 text-[14px] leading-snug text-ink-2", className)}>{children}</div>
  );
}

/** Barra fija al pie de los editores con las acciones de guardar. */
export function SaveBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-3 z-30 mt-6">
      <div className="glass flex flex-wrap items-center justify-end gap-2 rounded-[24px] border border-mist-2 p-3 shadow-float">
        {children}
      </div>
    </div>
  );
}

/* ───────────── Estados de carga y error ───────────── */

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cx("grid place-items-center py-24", className)}>
      <Spinner />
    </div>
  );
}

/** Mensaje legible de un error de tRPC (los de validación llegan como JSON). */
export function errorMessage(err: unknown): string {
  const e = err as { message?: string } | null;
  let msg = e?.message ?? "Algo falló. Inténtalo de nuevo.";
  if (msg.trim().startsWith("[")) {
    try {
      const issues = JSON.parse(msg) as { message?: string }[];
      if (issues[0]?.message) msg = issues[0].message;
    } catch {
      /* se deja el mensaje original */
    }
  }
  return msg;
}

export function errorCode(err: unknown): string | undefined {
  return (err as { data?: { code?: string } | null } | null)?.data?.code;
}

export function LoadError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="rounded-[24px] bg-white">
      <EmptyState title="No se pudo cargar" text={errorMessage(error)}>
        {retry && (
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        )}
      </EmptyState>
    </div>
  );
}

export function NotFound({ title, text, href, action }: { title: string; text?: string; href: string; action: string }) {
  return (
    <div className="rounded-[24px] bg-white">
      <EmptyState title={title} text={text}>
        <ButtonLink href={href} variant="secondary">
          {action}
        </ButtonLink>
      </EmptyState>
    </div>
  );
}

/* ───────────── Controles pequeños ───────────── */

/** Mueve un elemento una posición arriba (-1) o abajo (1). */
export function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
}

/** Par de botones subir / bajar para ordenar listas. */
export function Reorder({
  index,
  count,
  onMove,
  label,
  disabled,
  horizontal,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  /** Nombre de lo que se mueve, para lectores de pantalla. */
  label: string;
  disabled?: boolean;
  horizontal?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <IconButton
        label={`${horizontal ? "Mover antes" : "Subir"}: ${label}`}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        className="size-9!"
      >
        <ChevronUp className={cx("size-[18px]", horizontal && "-rotate-90")} aria-hidden />
      </IconButton>
      <IconButton
        label={`${horizontal ? "Mover después" : "Bajar"}: ${label}`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
        className="size-9!"
      >
        <ChevronDown className={cx("size-[18px]", horizontal && "-rotate-90")} aria-hidden />
      </IconButton>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Nombre accesible del campo. */
  label: string;
  className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-11"
        maxLength={80}
      />
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Píldora de filtro (una opción activa a la vez). */
export function Pill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] whitespace-nowrap transition-colors",
        active ? "bg-ink font-medium text-white" : "bg-white text-ink hover:bg-mist-2",
      )}
    >
      {children}
      {count !== undefined && <span className={cx("tabular-nums", active ? "text-white/70" : "text-ink-3")}>{count}</span>}
    </button>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad";
const TONE: Record<Tone, string> = {
  neutral: "bg-mist text-ink-2",
  good: "bg-good/12 text-good",
  warn: "bg-warn/12 text-warn",
  bad: "bg-bad/10 text-bad",
};
/** Etiqueta pequeña e informativa. */
export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Interruptor compacto con su nombre adentro, para filas de listas. */
export function SwitchChip({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40",
        checked ? "bg-good/12 text-good" : "bg-mist text-ink-3 hover:bg-mist-2 hover:text-ink-2",
      )}
    >
      {checked ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden />
      )}
      {label}
    </button>
  );
}

/** Campo de número entero. Vacío equivale a `null` si se permite, o a 0. */
export function IntInput({
  value,
  onChange,
  max = 1_000_000,
  allowEmpty,
  placeholder,
  className,
  ...rest
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  max?: number;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Input
      inputMode="numeric"
      className={className}
      placeholder={placeholder ?? (allowEmpty ? "" : "0")}
      value={value === null ? "" : String(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        if (raw === "") {
          onChange(allowEmpty ? null : 0);
          return;
        }
        onChange(Math.min(max, parseInt(raw, 10)));
      }}
      {...rest}
    />
  );
}

/** Imagen con título y ayuda, con el mismo aspecto que un campo de formulario. */
export function ImageInput({
  label,
  hint,
  value,
  onChange,
  fit,
  optional,
  className = "aspect-[4/3] max-w-[280px]",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  fit?: "cover" | "contain";
  optional?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[14px] font-medium text-ink">
        {label}
        {optional && <span className="text-[13px] font-normal text-ink-3">Opcional</span>}
      </p>
      <ImageField value={value} onChange={onChange} fit={fit} className={className} />
      {hint && <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{hint}</p>}
    </div>
  );
}

/** Miniatura cuadrada sobre fondo claro. */
export function Thumb({ src, className = "size-12" }: { src?: string | null; className?: string }) {
  return (
    <span className={cx("block shrink-0 overflow-hidden rounded-xl bg-mist", className)}>
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : null}
    </span>
  );
}

/** Fila de lista dentro de una tarjeta. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cx("flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-mist-2 py-4 first:border-t-0 first:pt-0 last:pb-0", className)}>
      {children}
    </li>
  );
}

/* ───────────── Formato ───────────── */

/** Como `useMoney`, pero permite indicar la moneda (los pedidos guardan la suya). */
export function useMoneyFor() {
  const shop = useShop();
  const storeCurrency = shop?.settings.currency ?? "USD";
  const locale = shop?.settings.locale ?? "es-CO";
  return useCallback(
    (cents: number, currency?: string) => formatMoney(cents, currency || storeCurrency, locale),
    [storeCurrency, locale],
  );
}

export const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

/* Clases compartidas por las tablas del panel. */
export const tableHead = "pb-3 text-left text-[13px] font-medium text-ink-2";
export const tableCell = "border-t border-mist-2 py-3.5 align-middle";

/** Para botones "ghost" que van directo sobre el fondo gris de la página. */
export const onMist = "bg-white hover:bg-mist-2!";
