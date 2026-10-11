import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ExternalLink, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { slugify } from "@shared/types";
import {
  Button,
  ButtonLink,
  Field,
  IconButton,
  Input,
  MoneyInput,
  Select,
  Spinner,
  Textarea,
  Toggle,
  confirmDialog,
  cx,
  toast,
  toastError,
  uploadFile,
} from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { Card, IntInput, LoadError, Loading, NotFound, PageHeader, Reorder, SaveBar, errorCode, move, onMist } from "./common";

type Detail = Out["admin"]["products"]["get"];

/**
 * Colores y fotos llevan una llave interna. Las fotos y el inventario apuntan
 * a esa llave y no al nombre, así que renombrar un color lo renombra en todas
 * partes y nunca se cruzan dos colores mientras se escribe.
 */
type ColorRow = { key: string; name: string; hex: string };
type ImageRow = { key: string; url: string; colorKey: string };
type Variant = { stock: number; sku: string };
type Form = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  details: string;
  price: number;
  compareAtPrice: number | null;
  categoryId: number | null;
  colors: ColorRow[];
  sizes: string[];
  images: ImageRow[];
  /** Llave: color (llave interna) + talla. */
  variants: Record<string, Variant>;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
};

const SEP = "\u0001";
const vkey = (colorKey: string, size: string) => `${colorKey}${SEP}${size}`;
const NO_VARIANT: Variant = { stock: 0, sku: "" };
let seq = 0;
const newKey = () => `k${++seq}`;

const MAX_COLORS = 24;
const MAX_SIZES = 24;
const MAX_IMAGES = 60;

const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "XS a XL", sizes: ["XS", "S", "M", "L", "XL"] },
  { label: "28 a 36", sizes: ["28", "30", "32", "34", "36"] },
  { label: "Talla única", sizes: [] },
];

const EMPTY: Form = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  details: "",
  price: 0,
  compareAtPrice: null,
  categoryId: null,
  colors: [],
  sizes: [],
  images: [],
  variants: {},
  isActive: true,
  isFeatured: false,
  isNew: false,
};

function fromDetail(p: Detail): Form {
  const colors = p.colors.map((c) => ({ key: newKey(), name: c.name, hex: c.hex }));
  const keyOf = (name: string) => colors.find((c) => c.name === name)?.key ?? "";
  return {
    name: p.name,
    slug: p.slug,
    tagline: p.tagline,
    description: p.description,
    details: p.details,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    categoryId: p.categoryId,
    colors,
    sizes: p.sizes,
    images: p.images.map((i) => ({ key: newKey(), url: i.url, colorKey: keyOf(i.color) })),
    variants: Object.fromEntries(p.variants.map((v) => [vkey(keyOf(v.color), v.size), { stock: v.stock, sku: v.sku }])),
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
  };
}

/** Pasa el inventario de un color a otro (al crear el primero o quitar el último). */
function moveColorStock(variants: Record<string, Variant>, from: string, to: string) {
  const next: Record<string, Variant> = {};
  for (const [k, v] of Object.entries(variants)) {
    const [color = "", size = ""] = k.split(SEP);
    next[color === from ? vkey(to, size) : k] = v;
  }
  return next;
}

export default function ProductEditor({ id }: { id: number | null }) {
  if (id === null) return <Editor id={null} initial={EMPTY} />;
  return <Existing id={id} />;
}

function Existing({ id }: { id: number }) {
  // Sin caché: el formulario siempre arranca con lo último que hay guardado.
  const q = trpc.admin.products.get.useQuery({ id }, { retry: false, staleTime: 0, gcTime: 0 });
  const initial = useMemo(() => (q.data ? fromDetail(q.data) : null), [q.data]);

  if (q.isPending) return <Loading />;
  if (q.isError || !initial) {
    return errorCode(q.error) === "NOT_FOUND" ? (
      <NotFound
        title="Ese producto no existe"
        text="Puede que lo hayan eliminado. Búscalo en la lista de productos."
        href="/admin/productos"
        action="Ver los productos"
      />
    ) : (
      <LoadError error={q.error} retry={() => q.refetch()} />
    );
  }
  return <Editor id={id} initial={initial} />;
}

function Editor({ id, initial }: { id: number | null; initial: Form }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<{ name?: string; price?: string; colors?: string }>({});
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [savedSlug, setSavedSlug] = useState(id ? initial.slug : "");
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const cats = trpc.admin.categories.list.useQuery();

  const refresh = () => {
    void utils.admin.products.invalidate();
    void utils.admin.categories.list.invalidate();
    void utils.admin.dashboard.invalidate();
  };

  const save = trpc.admin.products.save.useMutation({
    onSuccess: (res) => {
      toast("Producto guardado");
      refresh();
      if (id === null) {
        navigate(`/admin/productos/${res.id}`, { replace: true });
      } else {
        setSavedSlug(res.slug);
        patch({ slug: res.slug });
      }
    },
    onError: toastError,
  });

  const remove = trpc.admin.products.remove.useMutation({
    onSuccess: () => {
      toast("Producto eliminado");
      refresh();
      navigate("/admin/productos", { replace: true });
    },
    onError: toastError,
  });

  /* Combinaciones color × talla que se muestran y se guardan. */
  const colorAxis: ColorRow[] = form.colors.length ? form.colors : [{ key: "", name: "", hex: "" }];
  const sizeAxis = form.sizes.length ? form.sizes : [""];
  const totalStock = colorAxis.reduce(
    (sum, c) => sum + sizeAxis.reduce((n, s) => n + (form.variants[vkey(c.key, s)]?.stock ?? 0), 0),
    0,
  );

  const submit = () => {
    const next: typeof errors = {};
    const name = form.name.trim();
    if (!name) next.name = "Escribe el nombre del producto.";
    if (form.price <= 0) next.price = "Pon un precio mayor que cero.";
    const names = form.colors.map((c) => c.name.trim().toLowerCase());
    if (names.some((n) => !n)) next.colors = "Ponle nombre a cada color o quita el que sobra.";
    else if (new Set(names).size !== names.length) next.colors = "Hay dos colores con el mismo nombre.";
    setErrors(next);
    const first = next.name ?? next.price ?? next.colors;
    if (first) {
      toast(first, "error");
      return;
    }

    const colorName = new Map(form.colors.map((c) => [c.key, c.name.trim()]));
    save.mutate({
      id: id ?? undefined,
      name,
      slug: form.slug.trim(),
      tagline: form.tagline.trim(),
      description: form.description,
      details: form.details,
      price: form.price,
      compareAtPrice: form.compareAtPrice,
      categoryId: form.categoryId,
      colors: form.colors.map((c) => ({ name: c.name.trim(), hex: c.hex })),
      sizes: form.sizes,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      isNew: form.isNew,
      images: form.images.map((i) => ({ url: i.url, color: colorName.get(i.colorKey) ?? "" })),
      variants: colorAxis.flatMap((c) =>
        sizeAxis.map((s) => {
          const v = form.variants[vkey(c.key, s)] ?? NO_VARIANT;
          return { color: c.name.trim(), size: s, sku: v.sku.trim(), stock: v.stock };
        }),
      ),
    });
  };

  const askRemove = async () => {
    if (id === null) return;
    const ok = await confirmDialog({
      title: `¿Eliminar ${form.name.trim() || "este producto"}?`,
      text: "Se borra con sus fotos e inventario. Los pedidos que ya lo incluyen no cambian.",
      action: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate({ id });
  };

  const busy = save.isPending || remove.isPending;
  const autoSlug = slugify(form.slug || form.name);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/productos", label: "Productos" }}
        title={id === null ? "Nuevo producto" : form.name.trim() || "Producto sin nombre"}
      />

      <div className="space-y-4">
        <Card title="Información">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" error={errors.name}>
              <Input
                value={form.name}
                maxLength={160}
                aria-invalid={Boolean(errors.name)}
                onChange={(e) => {
                  patch({ name: e.target.value });
                  if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
                }}
              />
            </Field>
            <Field
              label="Dirección"
              hint={
                form.slug.trim() || !autoSlug
                  ? "Se genera sola si la dejas vacía."
                  : `Se genera sola si la dejas vacía. Quedará en /producto/${autoSlug}`
              }
            >
              <Input
                value={form.slug}
                maxLength={180}
                placeholder={autoSlug || "nombre-del-producto"}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => patch({ slug: e.target.value })}
                onBlur={() => patch({ slug: slugify(form.slug) })}
              />
            </Field>
            <Field label="Frase corta" optional className="sm:col-span-2">
              <Input value={form.tagline} maxLength={200} onChange={(e) => patch({ tagline: e.target.value })} />
            </Field>
            <Field label="Descripción" optional className="sm:col-span-2">
              <Textarea value={form.description} rows={5} maxLength={20000} onChange={(e) => patch({ description: e.target.value })} />
            </Field>
            <Field label="Detalles" optional hint="Una línea por detalle." className="sm:col-span-2">
              <Textarea
                value={form.details}
                rows={4}
                maxLength={20000}
                placeholder={"100 % algodón\nLavar con agua fría"}
                onChange={(e) => patch({ details: e.target.value })}
              />
            </Field>
            <Field label="Categoría">
              <Select value={form.categoryId ?? ""} onChange={(e) => patch({ categoryId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Sin categoría</option>
                {(cats.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Precio">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Precio" error={errors.price}>
              <MoneyInput
                value={form.price}
                onChange={(v) => {
                  patch({ price: v ?? 0 });
                  if (errors.price) setErrors((x) => ({ ...x, price: undefined }));
                }}
              />
            </Field>
            <Field label="Precio anterior" optional hint="Se muestra tachado si es mayor al precio.">
              <MoneyInput value={form.compareAtPrice} allowEmpty placeholder="" onChange={(v) => patch({ compareAtPrice: v })} />
            </Field>
          </div>
        </Card>

        <ColorsCard form={form} setForm={setForm} error={errors.colors} clearError={() => setErrors((x) => ({ ...x, colors: undefined }))} />
        <SizesCard form={form} setForm={setForm} />
        <PhotosCard form={form} setForm={setForm} uploading={uploading} setUploading={setUploading} />
        <InventoryCard form={form} setForm={setForm} colorAxis={colorAxis} sizeAxis={sizeAxis} totalStock={totalStock} />

        <Card title="Estado">
          <div className="space-y-4">
            <Toggle checked={form.isActive} onChange={(v) => patch({ isActive: v })} label="Activo" hint="Visible en la tienda" />
            <Toggle checked={form.isFeatured} onChange={(v) => patch({ isFeatured: v })} label="Destacado" hint="Sale en la portada" />
            <Toggle checked={form.isNew} onChange={(v) => patch({ isNew: v })} label="Nuevo" hint="Muestra la etiqueta Nuevo" />
          </div>
        </Card>
      </div>

      <SaveBar>
        {id !== null && (
          <>
            <Button variant="danger" className="mr-auto" loading={remove.isPending} disabled={busy} onClick={askRemove}>
              Eliminar
            </Button>
            {savedSlug && (
              <ButtonLink href={`/producto/${savedSlug}`} variant="secondary" external>
                Ver en la tienda
                <ExternalLink className="size-4" aria-hidden />
              </ButtonLink>
            )}
          </>
        )}
        <Button loading={save.isPending} disabled={busy || uploading !== null} onClick={submit}>
          Guardar producto
        </Button>
      </SaveBar>
    </>
  );
}

type SectionProps = { form: Form; setForm: (fn: (f: Form) => Form) => void };

/* ───────────── Colores ───────────── */

function ColorsCard({ form, setForm, error, clearError }: SectionProps & { error?: string; clearError: () => void }) {
  const add = () => {
    clearError();
    setForm((f) => {
      const key = newKey();
      return {
        ...f,
        colors: [...f.colors, { key, name: "", hex: "#1d1d1f" }],
        // El inventario que había sin color pasa al primer color que se crea.
        variants: f.colors.length === 0 ? moveColorStock(f.variants, "", key) : f.variants,
      };
    });
  };
  const update = (key: string, p: Partial<ColorRow>) => {
    clearError();
    setForm((f) => ({ ...f, colors: f.colors.map((c) => (c.key === key ? { ...c, ...p } : c)) }));
  };
  const remove = (key: string) => {
    clearError();
    setForm((f) => {
      const colors = f.colors.filter((c) => c.key !== key);
      return {
        ...f,
        colors,
        images: f.images.map((i) => (i.colorKey === key ? { ...i, colorKey: "" } : i)),
        // Al quitar el último color, su inventario queda como inventario sin color.
        variants: colors.length === 0 ? moveColorStock(f.variants, key, "") : f.variants,
      };
    });
  };

  return (
    <Card title="Colores" description="Si el producto viene en un solo color, puedes dejar esta sección vacía.">
      {form.colors.length > 0 && (
        <ul className="mb-4 space-y-2.5">
          {form.colors.map((c, i) => (
            <li key={c.key} className="flex items-center gap-2.5">
              <input
                type="color"
                aria-label={`Tono de ${c.name.trim() || `color ${i + 1}`}`}
                title="Elegir tono"
                value={c.hex}
                onChange={(e) => update(c.key, { hex: e.target.value })}
                className="h-12 w-14 shrink-0 cursor-pointer rounded-ctl border border-line bg-white p-1.5"
              />
              <Input
                aria-label={`Nombre del color ${i + 1}`}
                placeholder="Nombre del color. Ej: Negro"
                value={c.name}
                maxLength={40}
                onChange={(e) => update(c.key, { name: e.target.value })}
                className="min-w-0 flex-1"
              />
              <IconButton label={`Quitar ${c.name.trim() || `color ${i + 1}`}`} onClick={() => remove(c.key)}>
                <Trash2 className="size-[18px]" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mb-3 text-[13px] text-bad">
          {error}
        </p>
      )}
      <Button variant="secondary" size="sm" onClick={add} disabled={form.colors.length >= MAX_COLORS}>
        <Plus className="size-4" aria-hidden />
        Agregar color
      </Button>
    </Card>
  );
}

/* ───────────── Tallas ───────────── */

function SizesCard({ form, setForm }: SectionProps) {
  const [text, setText] = useState("");

  const add = () => {
    const wanted = text
      .split(",")
      .map((s) => s.trim().slice(0, 40))
      .filter(Boolean);
    setText("");
    if (!wanted.length) return;
    setForm((f) => {
      const sizes = [...f.sizes];
      for (const s of wanted) {
        if (sizes.length < MAX_SIZES && !sizes.some((x) => x.toLowerCase() === s.toLowerCase())) sizes.push(s);
      }
      return { ...f, sizes };
    });
  };

  return (
    <Card title="Tallas" description="Sin tallas, el producto se vende como talla única.">
      {form.sizes.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {form.sizes.map((s) => (
            <li key={s} className="inline-flex h-9 items-center gap-1 rounded-full bg-mist pl-4 pr-1 text-[15px] font-medium">
              {s}
              <button
                type="button"
                aria-label={`Quitar talla ${s}`}
                title="Quitar"
                onClick={() => setForm((f) => ({ ...f, sizes: f.sizes.filter((x) => x !== s) }))}
                className="grid size-7 place-items-center rounded-full text-ink-2 transition-colors hover:bg-mist-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex max-w-[420px] gap-2">
        <Input
          aria-label="Talla nueva"
          placeholder="Escribe una talla y presiona Enter"
          value={text}
          maxLength={120}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" className="h-12!" onClick={add} disabled={!text.trim() || form.sizes.length >= MAX_SIZES}>
          Agregar
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-ink-2">Usar un grupo:</span>
        {SIZE_PRESETS.map((p) => (
          <Button key={p.label} variant="secondary" size="sm" onClick={() => setForm((f) => ({ ...f, sizes: p.sizes }))}>
            {p.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

/* ───────────── Fotos ───────────── */

function PhotosCard({
  form,
  setForm,
  uploading,
  setUploading,
}: SectionProps & {
  uploading: { done: number; total: number } | null;
  setUploading: (v: { done: number; total: number } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const room = MAX_IMAGES - form.images.length;

  const onFiles = async (picked: File[]) => {
    const files = picked.slice(0, room);
    if (!files.length) return;
    if (picked.length > files.length) toast(`Un producto admite hasta ${MAX_IMAGES} fotos. Se suben las primeras ${files.length}.`, "error");
    setUploading({ done: 0, total: files.length });
    for (const [i, file] of files.entries()) {
      try {
        const url = await uploadFile(file);
        setForm((f) => ({ ...f, images: [...f.images, { key: newKey(), url, colorKey: "" }] }));
      } catch (err) {
        toastError(err);
      }
      setUploading({ done: i + 1, total: files.length });
    }
    setUploading(null);
  };

  const update = (key: string, colorKey: string) =>
    setForm((f) => ({ ...f, images: f.images.map((i) => (i.key === key ? { ...i, colorKey } : i)) }));

  return (
    <Card
      title="Fotos"
      description="La primera foto es la principal. Asigna cada foto a su color para que cambie al elegirlo. Se ven mejor en proporción 4:5 con fondo claro o transparente."
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void onFiles(files);
        }}
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {form.images.map((img, i) => (
          <li key={img.key} className="min-w-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-mist">
              <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 inline-flex h-6 items-center rounded-full bg-white px-2.5 text-[12px] font-medium shadow-sm">
                  Principal
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <Reorder
                horizontal
                index={i}
                count={form.images.length}
                label={`foto ${i + 1}`}
                onMove={(dir) => setForm((f) => ({ ...f, images: move(f.images, i, dir) }))}
              />
              <IconButton
                label={`Eliminar foto ${i + 1}`}
                className="size-9!"
                onClick={() => setForm((f) => ({ ...f, images: f.images.filter((x) => x.key !== img.key) }))}
              >
                <Trash2 className="size-[18px]" aria-hidden />
              </IconButton>
            </div>
            {form.colors.length > 0 && (
              <Select aria-label={`Color de la foto ${i + 1}`} className="mt-1" value={img.colorKey} onChange={(e) => update(img.key, e.target.value)}>
                <option value="">Todos los colores</option>
                {form.colors.map((c, n) => (
                  <option key={c.key} value={c.key}>
                    {c.name.trim() || `Color ${n + 1}`}
                  </option>
                ))}
              </Select>
            )}
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              type="button"
              disabled={uploading !== null}
              onClick={() => input.current?.click()}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-[20px] bg-mist px-3 text-center text-[14px] text-ink-2 transition-colors hover:bg-mist-2 disabled:hover:bg-mist"
            >
              {uploading ? <Spinner /> : <ImagePlus className="size-6" aria-hidden />}
              <span aria-live="polite">
                {uploading ? `Subiendo ${Math.min(uploading.done + 1, uploading.total)} de ${uploading.total}…` : "Subir fotos"}
              </span>
            </button>
          </li>
        )}
      </ul>
    </Card>
  );
}

/* ───────────── Inventario ───────────── */

function InventoryCard({
  form,
  setForm,
  colorAxis,
  sizeAxis,
  totalStock,
}: SectionProps & { colorAxis: ColorRow[]; sizeAxis: string[]; totalStock: number }) {
  const [all, setAll] = useState<number | null>(null);
  const hasColors = form.colors.length > 0;
  const hasSizes = form.sizes.length > 0;
  const count = colorAxis.length * sizeAxis.length;

  const update = (key: string, p: Partial<Variant>) =>
    setForm((f) => ({ ...f, variants: { ...f.variants, [key]: { ...(f.variants[key] ?? NO_VARIANT), ...p } } }));

  const setEvery = () => {
    if (all === null) return;
    setForm((f) => {
      const variants = { ...f.variants };
      for (const c of colorAxis) {
        for (const s of sizeAxis) {
          const k = vkey(c.key, s);
          variants[k] = { ...(variants[k] ?? NO_VARIANT), stock: all };
        }
      }
      return { ...f, variants };
    });
    setAll(null);
  };

  return (
    <Card
      title="Inventario"
      description={
        count > 1
          ? `${totalStock} ${totalStock === 1 ? "unidad" : "unidades"} en ${count} combinaciones de color y talla.`
          : "Unidades disponibles para la venta."
      }
    >
      {count > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-mist px-4 py-3">
          <label htmlFor="stock-all" className="text-[14px] text-ink">
            Poner todas en
          </label>
          <IntInput id="stock-all" value={all} onChange={setAll} allowEmpty placeholder="0" className="w-24!" />
          <Button variant="ghost" size="sm" className={onMist} disabled={all === null} onClick={setEvery}>
            Aplicar
          </Button>
        </div>
      )}

      <div className="hidden gap-3 pb-2 text-[13px] font-medium text-ink-2 sm:grid sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)]">
        <span>{hasColors && hasSizes ? "Color y talla" : hasColors ? "Color" : hasSizes ? "Talla" : "Producto"}</span>
        <span>Unidades</span>
        <span>SKU</span>
      </div>
      <ul>
        {colorAxis.flatMap((c, ci) =>
          sizeAxis.map((s) => {
            const k = vkey(c.key, s);
            const v = form.variants[k] ?? NO_VARIANT;
            const colorLabel = hasColors ? c.name.trim() || `Color ${ci + 1}` : "";
            const label = [colorLabel, s].filter(Boolean).join(" / ") || "Talla única";
            return (
              <li
                key={k}
                className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-t border-mist-2 py-3 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)]"
              >
                <span className="col-span-2 flex min-w-0 items-center gap-2.5 text-[15px] sm:col-span-1">
                  {hasColors && (
                    <span className="size-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} aria-hidden />
                  )}
                  <span className="truncate">{label}</span>
                </span>
                <IntInput value={v.stock} onChange={(n) => update(k, { stock: n ?? 0 })} aria-label={`Unidades de ${label}`} className={cx(v.stock === 0 && "text-ink-3!")} />
                <Input
                  value={v.sku}
                  maxLength={80}
                  placeholder="SKU (opcional)"
                  aria-label={`SKU de ${label}`}
                  onChange={(e) => update(k, { sku: e.target.value })}
                />
              </li>
            );
          }),
        )}
      </ul>
    </Card>
  );
}
