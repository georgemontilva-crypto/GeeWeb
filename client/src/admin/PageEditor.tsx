import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { BLOCK_LABEL, RESERVED_SLUGS, slugify, type Block, type BlockType } from "@shared/types";
import { Button, ButtonLink, Field, IconButton, Input, Select, Textarea, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { Card, ImageInput, LoadError, Loading, NotFound, PageHeader, Reorder, SaveBar, errorCode, move } from "./common";

type PageData = Out["admin"]["pages"]["get"];
type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;
/** Cada bloque lleva una llave interna para que React no mezcle sus campos al moverlos. */
type BlockRow = { key: string; block: Block };
type Form = {
  title: string;
  slug: string;
  intro: string;
  seoDescription: string;
  showInNav: boolean;
  showInFooter: boolean;
  isPublished: boolean;
  blocks: BlockRow[];
};

let seq = 0;
const newKey = () => `b${++seq}`;
const MAX_BLOCKS = 80;
const MAX_QUESTIONS = 60;
const BLOCK_TYPES = Object.keys(BLOCK_LABEL) as BlockType[];

/** Bloques nuevos, con los mismos valores iniciales que define el esquema. */
const NEW_BLOCK: { [K in BlockType]: () => BlockOf<K> } = {
  texto: () => ({ type: "texto", title: "", body: "", align: "izquierda" }),
  imagen: () => ({ type: "imagen", url: "", caption: "" }),
  imagen_texto: () => ({ type: "imagen_texto", url: "", title: "", body: "", imageSide: "izquierda" }),
  preguntas: () => ({ type: "preguntas", title: "", items: [{ q: "", a: "" }] }),
  boton: () => ({ type: "boton", title: "", body: "", label: "", href: "" }),
};

const EMPTY: Form = {
  title: "",
  slug: "",
  intro: "",
  seoDescription: "",
  showInNav: false,
  showInFooter: true,
  isPublished: true,
  blocks: [{ key: newKey(), block: NEW_BLOCK.texto() }],
};

const fromPage = (p: PageData): Form => ({
  title: p.title,
  slug: p.slug,
  intro: p.intro,
  seoDescription: p.seoDescription,
  showInNav: p.showInNav,
  showInFooter: p.showInFooter,
  isPublished: p.isPublished,
  blocks: p.blocks.map((block) => ({ key: newKey(), block })),
});

export default function PageEditor({ id }: { id: number | null }) {
  if (id === null) return <Editor id={null} initial={EMPTY} />;
  return <Existing id={id} />;
}

function Existing({ id }: { id: number }) {
  // Sin caché: el formulario siempre arranca con lo último que hay guardado.
  const q = trpc.admin.pages.get.useQuery({ id }, { retry: false, staleTime: 0, gcTime: 0 });
  const initial = useMemo(() => (q.data ? fromPage(q.data) : null), [q.data]);

  if (q.isPending) return <Loading />;
  if (q.isError || !initial) {
    return errorCode(q.error) === "NOT_FOUND" ? (
      <NotFound
        title="Esa página no existe"
        text="Puede que la hayan eliminado. Búscala en la lista de páginas."
        href="/admin/paginas"
        action="Ver las páginas"
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
  const [errors, setErrors] = useState<{ title?: string; slug?: string }>({});
  const [saved, setSaved] = useState(id ? { slug: initial.slug, isPublished: initial.isPublished } : null);
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const refresh = () => {
    void utils.admin.pages.invalidate();
    // Menú, pie de página (bootstrap) y el contenido de la página en la tienda.
    void utils.store.invalidate();
  };

  const save = trpc.admin.pages.save.useMutation({
    onSuccess: (res, vars) => {
      toast("Página guardada");
      refresh();
      if (id === null) {
        navigate(`/admin/paginas/${res.id}`, { replace: true });
      } else {
        setSaved({ slug: res.slug, isPublished: vars.isPublished ?? true });
        patch({ slug: res.slug });
      }
    },
    onError: toastError,
  });

  const remove = trpc.admin.pages.remove.useMutation({
    onSuccess: () => {
      toast("Página eliminada");
      refresh();
      navigate("/admin/paginas", { replace: true });
    },
    onError: toastError,
  });

  const wanted = slugify(form.slug || form.title);
  const reserved = RESERVED_SLUGS.includes(wanted);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const submit = () => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Escribe el título de la página.";
    if (reserved) next.slug = `La dirección /${wanted} ya la usa la tienda. Elige otra.`;
    setErrors(next);
    const first = next.title ?? next.slug;
    if (first) {
      toast(first, "error");
      return;
    }
    save.mutate({
      id: id ?? undefined,
      title: form.title.trim(),
      slug: form.slug.trim(),
      intro: form.intro.trim(),
      seoDescription: form.seoDescription.trim(),
      blocks: form.blocks.map((b) => b.block),
      showInNav: form.showInNav,
      showInFooter: form.showInFooter,
      isPublished: form.isPublished,
    });
  };

  const askRemove = async () => {
    if (id === null) return;
    const ok = await confirmDialog({
      title: `¿Eliminar ${form.title.trim() || "esta página"}?`,
      text: "Desaparece de la tienda, del menú y del pie de página. No se puede deshacer.",
      action: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate({ id });
  };

  const setBlock = (key: string, block: Block) =>
    setForm((f) => ({ ...f, blocks: f.blocks.map((b) => (b.key === key ? { ...b, block } : b)) }));
  const addBlock = (type: BlockType) => setForm((f) => ({ ...f, blocks: [...f.blocks, { key: newKey(), block: NEW_BLOCK[type]() }] }));
  const removeBlock = async (row: BlockRow) => {
    if (!isBlank(row.block)) {
      const ok = await confirmDialog({
        title: "¿Quitar este bloque?",
        text: `${BLOCK_LABEL[row.block.type]}: se pierde lo que escribiste en él.`,
        action: "Quitar bloque",
        danger: true,
      });
      if (!ok) return;
    }
    setForm((f) => ({ ...f, blocks: f.blocks.filter((b) => b.key !== row.key) }));
  };

  const busy = save.isPending || remove.isPending;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/paginas", label: "Páginas" }}
        title={id === null ? "Nueva página" : form.title.trim() || "Página sin título"}
      />

      <div className="space-y-4">
        <Card title="Información">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" error={errors.title}>
              <Input
                value={form.title}
                maxLength={160}
                aria-invalid={Boolean(errors.title)}
                onChange={(e) => {
                  patch({ title: e.target.value });
                  if (errors.title) setErrors((x) => ({ ...x, title: undefined }));
                }}
              />
            </Field>
            <Field
              label="Dirección"
              error={reserved ? `La dirección /${wanted} ya la usa la tienda. Elige otra.` : undefined}
              hint={wanted ? `Se genera sola si la dejas vacía. Quedará en ${origin}/${wanted}` : "Se genera sola si la dejas vacía."}
            >
              <Input
                value={form.slug}
                maxLength={140}
                placeholder={wanted || "titulo-de-la-pagina"}
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={reserved}
                onChange={(e) => patch({ slug: e.target.value })}
                onBlur={() => patch({ slug: slugify(form.slug) })}
              />
            </Field>
            <Field label="Introducción" optional hint="Un párrafo corto que va debajo del título." className="sm:col-span-2">
              <Textarea value={form.intro} rows={2} maxLength={400} onChange={(e) => patch({ intro: e.target.value })} />
            </Field>
            <Field
              label="Descripción para buscadores"
              optional
              hint="Es el texto que muestran Google y las redes al compartir el enlace."
              className="sm:col-span-2"
            >
              <Textarea value={form.seoDescription} rows={2} maxLength={300} onChange={(e) => patch({ seoDescription: e.target.value })} />
            </Field>
          </div>
          <div className="mt-6 space-y-4 border-t border-mist-2 pt-5">
            <Toggle checked={form.showInNav} onChange={(v) => patch({ showInNav: v })} label="Mostrar en el menú" />
            <Toggle checked={form.showInFooter} onChange={(v) => patch({ showInFooter: v })} label="Mostrar en el pie de página" />
            <Toggle
              checked={form.isPublished}
              onChange={(v) => patch({ isPublished: v })}
              label="Publicada"
              hint="Si la apagas queda como borrador y nadie la ve en la tienda"
            />
          </div>
        </Card>

        <div className="px-1 pt-4">
          <h2 className="text-[19px] font-semibold">Contenido</h2>
          <p className="mt-1.5 text-[14px] text-ink-2">La página se arma con bloques, en este orden.</p>
        </div>

        {form.blocks.length === 0 && (
          <div className="rounded-[24px] bg-white px-6 py-10 text-center text-[15px] text-ink-2">
            Esta página aún no tiene contenido. Agrega el primer bloque aquí abajo.
          </div>
        )}

        {form.blocks.map((row, i) => (
          <Card
            key={row.key}
            title={BLOCK_LABEL[row.block.type]}
            actions={
              <div className="-my-1.5 flex items-center">
                <Reorder
                  index={i}
                  count={form.blocks.length}
                  label={`bloque ${i + 1}`}
                  onMove={(dir) => setForm((f) => ({ ...f, blocks: move(f.blocks, i, dir) }))}
                />
                <IconButton label={`Quitar bloque ${i + 1}`} className="size-9!" onClick={() => removeBlock(row)}>
                  <Trash2 className="size-[18px]" aria-hidden />
                </IconButton>
              </div>
            }
          >
            <BlockForm block={row.block} onChange={(b) => setBlock(row.key, b)} />
          </Card>
        ))}

        <Card title="Agregar bloque">
          <div className="flex flex-wrap gap-2">
            {BLOCK_TYPES.map((t) => (
              <Button key={t} variant="secondary" size="sm" disabled={form.blocks.length >= MAX_BLOCKS} onClick={() => addBlock(t)}>
                <Plus className="size-4" aria-hidden />
                {BLOCK_LABEL[t]}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      <SaveBar>
        {id !== null && (
          <>
            <Button variant="danger" className="mr-auto" loading={remove.isPending} disabled={busy} onClick={askRemove}>
              Eliminar
            </Button>
            {saved?.isPublished && (
              <ButtonLink href={`/${saved.slug}`} variant="secondary" external>
                Ver página
                <ExternalLink className="size-4" aria-hidden />
              </ButtonLink>
            )}
          </>
        )}
        <Button loading={save.isPending} disabled={busy} onClick={submit}>
          Guardar página
        </Button>
      </SaveBar>
    </>
  );
}

/** Un bloque recién agregado y sin llenar se quita sin preguntar. */
function isBlank(b: Block): boolean {
  switch (b.type) {
    case "texto":
      return !b.title && !b.body;
    case "imagen":
      return !b.url && !b.caption;
    case "imagen_texto":
      return !b.url && !b.title && !b.body;
    case "preguntas":
      return !b.title && b.items.every((x) => !x.q && !x.a);
    case "boton":
      return !b.title && !b.body && !b.label && !b.href;
  }
}

/* ───────────── Formularios por tipo de bloque ───────────── */

function BlockForm({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case "texto":
      return (
        <div className="space-y-4">
          <Field label="Título" optional>
            <Input value={block.title} maxLength={200} onChange={(e) => onChange({ ...block, title: e.target.value })} />
          </Field>
          <Field label="Texto" hint="Deja una línea en blanco para separar párrafos.">
            <Textarea value={block.body} rows={7} maxLength={20000} onChange={(e) => onChange({ ...block, body: e.target.value })} />
          </Field>
          <Field label="Alineación" className="max-w-[260px]">
            <Select value={block.align} onChange={(e) => onChange({ ...block, align: e.target.value === "centro" ? "centro" : "izquierda" })}>
              <option value="izquierda">Izquierda</option>
              <option value="centro">Centro</option>
            </Select>
          </Field>
        </div>
      );

    case "imagen":
      return (
        <div className="space-y-4">
          <ImageInput label="Imagen" value={block.url} onChange={(url) => onChange({ ...block, url })} className="aspect-[16/9] max-w-[520px]" />
          <Field label="Pie de foto" optional>
            <Input value={block.caption} maxLength={300} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
          </Field>
        </div>
      );

    case "imagen_texto":
      return (
        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <ImageInput label="Imagen" value={block.url} onChange={(url) => onChange({ ...block, url })} className="aspect-[4/5] max-w-[240px]" />
          <div className="space-y-4">
            <Field label="Título" optional>
              <Input value={block.title} maxLength={200} onChange={(e) => onChange({ ...block, title: e.target.value })} />
            </Field>
            <Field label="Texto" hint="Deja una línea en blanco para separar párrafos.">
              <Textarea value={block.body} rows={6} maxLength={20000} onChange={(e) => onChange({ ...block, body: e.target.value })} />
            </Field>
            <Field label="Lado de la imagen" className="max-w-[260px]">
              <Select
                value={block.imageSide}
                onChange={(e) => onChange({ ...block, imageSide: e.target.value === "derecha" ? "derecha" : "izquierda" })}
              >
                <option value="izquierda">Izquierda</option>
                <option value="derecha">Derecha</option>
              </Select>
            </Field>
          </div>
        </div>
      );

    case "preguntas":
      return <QuestionsForm block={block} onChange={onChange} />;

    case "boton":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" optional className="sm:col-span-2">
            <Input value={block.title} maxLength={200} onChange={(e) => onChange({ ...block, title: e.target.value })} />
          </Field>
          <Field label="Texto" optional className="sm:col-span-2">
            <Textarea value={block.body} rows={3} maxLength={2000} onChange={(e) => onChange({ ...block, body: e.target.value })} />
          </Field>
          <Field label="Texto del botón">
            <Input value={block.label} maxLength={60} placeholder="Ej: Ver la colección" onChange={(e) => onChange({ ...block, label: e.target.value })} />
          </Field>
          <Field label="Enlace del botón" hint="Una dirección de la tienda, como /tienda, o un enlace completo.">
            <Input
              value={block.href}
              maxLength={400}
              placeholder="/tienda"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => onChange({ ...block, href: e.target.value })}
            />
          </Field>
        </div>
      );
  }
}

function QuestionsForm({ block, onChange }: { block: BlockOf<"preguntas">; onChange: (b: Block) => void }) {
  const setItem = (i: number, p: Partial<{ q: string; a: string }>) =>
    onChange({ ...block, items: block.items.map((x, n) => (n === i ? { ...x, ...p } : x)) });

  return (
    <div className="space-y-4">
      <Field label="Título" optional>
        <Input value={block.title} maxLength={200} placeholder="Ej: Preguntas frecuentes" onChange={(e) => onChange({ ...block, title: e.target.value })} />
      </Field>
      {block.items.length > 0 && (
        <ol className="space-y-3">
          {block.items.map((item, i) => (
            <li key={i} className="rounded-[20px] bg-mist p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[14px] font-medium">Pregunta {i + 1}</p>
                <div className="-my-1 flex items-center">
                  <Reorder
                    index={i}
                    count={block.items.length}
                    label={`pregunta ${i + 1}`}
                    onMove={(dir) => onChange({ ...block, items: move(block.items, i, dir) })}
                  />
                  <IconButton
                    label={`Quitar pregunta ${i + 1}`}
                    className="size-9! hover:bg-mist-2!"
                    onClick={() => onChange({ ...block, items: block.items.filter((_, n) => n !== i) })}
                  >
                    <Trash2 className="size-[18px]" aria-hidden />
                  </IconButton>
                </div>
              </div>
              <div className="space-y-2.5">
                <Input
                  aria-label={`Pregunta ${i + 1}`}
                  placeholder="Pregunta"
                  value={item.q}
                  maxLength={300}
                  onChange={(e) => setItem(i, { q: e.target.value })}
                />
                <Textarea
                  aria-label={`Respuesta ${i + 1}`}
                  placeholder="Respuesta"
                  value={item.a}
                  rows={3}
                  maxLength={5000}
                  onChange={(e) => setItem(i, { a: e.target.value })}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={block.items.length >= MAX_QUESTIONS}
        onClick={() => onChange({ ...block, items: [...block.items, { q: "", a: "" }] })}
      >
        <Plus className="size-4" aria-hidden />
        Agregar pregunta
      </Button>
    </div>
  );
}
