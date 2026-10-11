import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { clsx, type ClassValue } from "clsx";
import { Check, ChevronDown, ImagePlus, Loader2, X } from "lucide-react";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@shared/types";

export const cx = (...v: ClassValue[]) => clsx(v);

/* ───────────── Botones ───────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-85 active:opacity-75",
  secondary: "bg-mist text-ink hover:bg-mist-2",
  ghost: "text-ink hover:bg-mist",
  danger: "bg-bad/10 text-bad hover:bg-bad/15",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-7 text-[17px]",
};
const btn = (variant: Variant, size: Size, className?: string) =>
  cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] whitespace-nowrap",
    "transition-[opacity,background-color,transform] duration-200 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
    VARIANT[variant],
    SIZE[size],
    className,
  );

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={btn(variant, size, className)} {...rest}>
      {loading && <Loader2 className="size-4 animate-[spin_0.8s_linear_infinite]" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external || /^https?:|^mailto:|^tel:/.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={btn(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={btn(variant, size, className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist disabled:opacity-30",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-5 animate-[spin_0.8s_linear_infinite] text-ink-3", className)} aria-label="Cargando" />;
}

/* ───────────── Formularios ───────────── */

const control =
  "w-full rounded-ctl border border-line bg-white px-4 text-[16px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink-3 focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/8 disabled:bg-mist disabled:text-ink-3";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <label className={cx("block", className)}>
      {label && (
        <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[14px] font-medium text-ink">
          {label}
          {optional && <span className="text-[13px] font-normal text-ink-3">Opcional</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px] leading-snug text-ink-2">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(control, "h-12", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cx(control, "py-3 leading-relaxed", className)} {...rest} />;
  },
);

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx("relative block", className)}>
      <select className={cx(control, "h-12 appearance-none pr-10")} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40",
          checked ? "bg-good" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute left-[3px] top-[3px] size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked && "translate-x-[18px]",
          )}
        />
      </button>
      {(label || hint) && (
        <label htmlFor={id} className="min-w-0">
          {label && <span className="block text-[15px] font-medium leading-snug text-ink">{label}</span>}
          {hint && <span className="block text-[13px] leading-snug text-ink-2">{hint}</span>}
        </label>
      )}
    </div>
  );
}

/** Campo de dinero: muestra unidades (12.50) y guarda centavos (1250). */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  allowEmpty,
  className,
}: {
  value: number | null;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const fmt = (c: number | null) => (c === null ? "" : (c / 100).toFixed(c % 100 === 0 ? 0 : 2));
  const [text, setText] = useState(fmt(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(fmt(value));
    }
  }, [value]);
  return (
    <Input
      inputMode="decimal"
      className={className}
      placeholder={placeholder ?? "0"}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
        setText(raw);
        if (raw === "") {
          last.current = allowEmpty ? null : 0;
          onChange(last.current);
          return;
        }
        const n = Math.round(parseFloat(raw) * 100);
        if (Number.isFinite(n)) {
          last.current = n;
          onChange(n);
        }
      }}
      onBlur={() => setText(fmt(last.current))}
    />
  );
}

/* ───────────── Ventana modal ───────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-[fade-in_0.2s_ease] bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative flex max-h-[92dvh] w-full animate-[rise-in_0.28s_var(--ease-apple)] flex-col overflow-hidden bg-white shadow-sheet",
          "rounded-t-[28px] sm:rounded-[28px]",
          size === "sm" && "sm:max-w-[420px]",
          size === "md" && "sm:max-w-[560px]",
          size === "lg" && "sm:max-w-[820px]",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-2">
          <h2 className="text-[21px]">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-mist-2 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────── Avisos (toasts) y confirmaciones ───────────── */

type Toast = { id: number; text: string; kind: "ok" | "error" };
type Ask = { title: string; text?: string; action: string; danger?: boolean; resolve: (v: boolean) => void };

let toasts: Toast[] = [];
let ask: Ask | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
let seq = 0;

export function toast(text: string, kind: Toast["kind"] = "ok") {
  const id = ++seq;
  toasts = [...toasts, { id, text, kind }];
  emit();
  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    kind === "error" ? 6000 : 3200,
  );
}
/** Muestra el mensaje de un error de tRPC o de red. */
export function toastError(err: unknown) {
  const e = err as { message?: string; data?: { zodError?: unknown } };
  let msg = e?.message ?? "Algo falló. Inténtalo de nuevo.";
  // Los errores de validación llegan como un arreglo JSON en el mensaje.
  if (msg.trim().startsWith("[")) {
    try {
      const issues = JSON.parse(msg) as { message: string }[];
      if (issues[0]?.message) msg = issues[0].message;
    } catch {
      /* se deja el mensaje original */
    }
  }
  toast(msg, "error");
}

export function confirmDialog(opts: Omit<Ask, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    ask = { ...opts, resolve };
    emit();
  });
}

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, () => toasts);
  const current = useSyncExternalStore(subscribe, () => ask);
  const close = (v: boolean) => {
    current?.resolve(v);
    ask = null;
    emit();
  };
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {list.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex max-w-[92vw] animate-[rise-in_0.3s_var(--ease-apple)] items-center gap-2.5 rounded-full px-5 py-3 text-[15px] font-medium text-white shadow-float",
              t.kind === "error" ? "bg-bad" : "bg-ink",
            )}
          >
            {t.kind === "ok" && <Check className="size-4" aria-hidden />}
            {t.text}
          </div>
        ))}
      </div>
      <Modal
        open={Boolean(current)}
        onClose={() => close(false)}
        title={current?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={current?.danger ? "danger" : "primary"} onClick={() => close(true)}>
              {current?.action}
            </Button>
          </>
        }
      >
        {current?.text && <p className="text-[15px] text-ink-2">{current.text}</p>}
      </Modal>
    </>
  );
}

/* ───────────── Estado de pedido ───────────── */

const STATUS_TONE: Record<OrderStatus, string> = {
  pendiente: "bg-warn/12 text-warn",
  pagado: "bg-[#0a66c2]/10 text-[#0a57a5]",
  preparando: "bg-[#6b46c1]/10 text-[#5a37ab]",
  enviado: "bg-[#0e7490]/10 text-[#0b6079]",
  entregado: "bg-good/12 text-good",
  cancelado: "bg-ink/8 text-ink-2",
};
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as OrderStatus;
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-full px-3 text-[13px] font-medium whitespace-nowrap",
        STATUS_TONE[s] ?? "bg-mist text-ink-2",
        className,
      )}
    >
      {ORDER_STATUS_LABEL[s] ?? status}
    </span>
  );
}

/* ───────────── Subida de imágenes ───────────── */

export async function uploadFile(file: File, endpoint = "/api/upload", extra?: Record<string, string>): Promise<string> {
  const body = new FormData();
  for (const [k, v] of Object.entries(extra ?? {})) body.append(k, v);
  body.append("file", file);
  const res = await fetch(endpoint, { method: "POST", body, credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "No se pudo subir el archivo.");
  return data.url;
}

/** Recuadro para subir o cambiar una sola imagen. */
export function ImageField({
  value,
  onChange,
  label = "Subir imagen",
  className,
  fit = "cover",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={cx("relative overflow-hidden rounded-[20px] bg-mist", className)}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onChange(await uploadFile(f));
          } catch (err) {
            toastError(err);
          } finally {
            setBusy(false);
          }
        }}
      />
      {value ? (
        <>
          <img src={value} alt="" className={cx("size-full", fit === "cover" ? "object-cover" : "object-contain p-4")} />
          <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="glass rounded-full px-3 py-1.5 text-[13px] font-medium shadow-sm"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="glass rounded-full px-3 py-1.5 text-[13px] font-medium text-bad shadow-sm"
            >
              Quitar
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex size-full min-h-[120px] flex-col items-center justify-center gap-2 text-[14px] text-ink-2 transition-colors hover:bg-mist-2"
        >
          {busy ? <Spinner /> : <ImagePlus className="size-6" aria-hidden />}
          {busy ? "Subiendo…" : label}
        </button>
      )}
      {busy && value && (
        <div className="absolute inset-0 grid place-items-center bg-white/60">
          <Spinner />
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <h3 className="text-[21px]">{title}</h3>
      {text && <p className="mt-2 max-w-[44ch] text-[15px] text-ink-2">{text}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
