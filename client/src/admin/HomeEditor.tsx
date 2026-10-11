import { useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import type { Settings } from "@shared/types";
import { Button, ButtonLink, Field, IconButton, Input, Select, Textarea } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Card, ImageInput, PageHeader, SaveBar } from "./common";
import { SettingsLoader, useSaveSettings } from "./settingsForm";

type Home = Settings["home"];
const MAX_PERKS = 4;

export default function HomeEditor() {
  return (
    <>
      <PageHeader title="Portada" description="Los textos e imágenes de la página de inicio de la tienda." />
      <SettingsLoader>{(initial) => <Form initial={initial} />}</SettingsLoader>
    </>
  );
}

function Form({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const save = useSaveSettings("Portada guardada");
  const products = trpc.admin.products.list.useQuery();

  const set = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }));
  const setHome = (p: Partial<Home>) => setS((x) => ({ ...x, home: { ...x.home, ...p } }));
  const home = s.home;

  const productOptions = (products.data ?? []).map((p) => (
    <option key={p.id} value={p.id}>
      {p.isActive ? p.name : `${p.name} (oculto)`}
    </option>
  ));
  const toId = (v: string) => (v ? Number(v) : null);
  /** Si el producto elegido ya no existe, se avisa en la misma lista. */
  const goneOption = (id: number | null) =>
    id !== null && products.data && !products.data.some((p) => p.id === id) ? <option value={id}>Producto eliminado</option> : null;

  return (
    <>
      <div className="space-y-4">
        <Card title="Barra de anuncio" description="La franja que va arriba de todo en la tienda.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Texto del anuncio" hint="Déjalo vacío para ocultarla.">
              <Input value={s.announcement} maxLength={200} onChange={(e) => set({ announcement: e.target.value })} />
            </Field>
            <Field label="Enlace del anuncio" optional hint="A dónde lleva al tocarlo. Ej: /tienda">
              <Input
                value={s.announcementHref}
                maxLength={400}
                placeholder="/tienda"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => set({ announcementHref: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Principal" description="Lo primero que ve quien entra a la tienda.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2">
              <Input value={home.heroTitle} maxLength={80} onChange={(e) => setHome({ heroTitle: e.target.value })} />
            </Field>
            <Field label="Subtítulo" optional className="sm:col-span-2">
              <Textarea value={home.heroSubtitle} rows={2} maxLength={200} onChange={(e) => setHome({ heroSubtitle: e.target.value })} />
            </Field>
            <Field label="Texto del botón">
              <Input value={home.heroCtaLabel} maxLength={40} onChange={(e) => setHome({ heroCtaLabel: e.target.value })} />
            </Field>
            <Field label="Enlace del botón">
              <Input
                value={home.heroCtaHref}
                maxLength={400}
                placeholder="/tienda"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setHome({ heroCtaHref: e.target.value })}
              />
            </Field>
            <Field label="Producto que se muestra" className="sm:col-span-2">
              <Select value={home.heroProductId ?? ""} onChange={(e) => setHome({ heroProductId: toId(e.target.value) })}>
                <option value="">Automático (primer destacado)</option>
                {goneOption(home.heroProductId)}
                {productOptions}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <ImageInput
                label="Foto de portada"
                hint="Opcional. Si subes una foto, ocupa toda la portada en lugar del producto."
                value={home.heroImageUrl}
                onChange={(url) => setHome({ heroImageUrl: url })}
                className="aspect-[16/9] max-w-[520px]"
              />
            </div>
          </div>
        </Card>

        <Card title="Vitrina de colores" description="Un producto que el cliente puede ver cambiar de color.">
          <div className="grid gap-4">
            <Field label="Producto">
              <Select value={home.showcaseProductId ?? ""} onChange={(e) => setHome({ showcaseProductId: toId(e.target.value) })}>
                <option value="">Automático</option>
                {goneOption(home.showcaseProductId)}
                {productOptions}
              </Select>
            </Field>
            <Field label="Título">
              <Input value={home.showcaseTitle} maxLength={120} onChange={(e) => setHome({ showcaseTitle: e.target.value })} />
            </Field>
            <Field label="Texto" optional>
              <Textarea value={home.showcaseText} rows={3} maxLength={400} onChange={(e) => setHome({ showcaseText: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Historia" description="Un bloque para contar quién está detrás de la marca.">
          <div className="grid gap-4">
            <Field label="Título">
              <Input value={home.storyTitle} maxLength={160} onChange={(e) => setHome({ storyTitle: e.target.value })} />
            </Field>
            <Field label="Texto" optional>
              <Textarea value={home.storyText} rows={4} maxLength={600} onChange={(e) => setHome({ storyText: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Ventajas" description={`Hasta ${MAX_PERKS} razones cortas para comprar: envío, cambios, pagos.`}>
          {home.perks.length > 0 && (
            <ul className="mb-4 space-y-3">
              {home.perks.map((perk, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                    <Input
                      aria-label={`Título de la ventaja ${i + 1}`}
                      placeholder="Título. Ej: Envío rápido"
                      value={perk.title}
                      maxLength={60}
                      onChange={(e) => setHome({ perks: home.perks.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)) })}
                    />
                    <Input
                      aria-label={`Texto de la ventaja ${i + 1}`}
                      placeholder="Texto. Ej: Despachamos en 24 horas hábiles."
                      value={perk.text}
                      maxLength={200}
                      onChange={(e) => setHome({ perks: home.perks.map((x, n) => (n === i ? { ...x, text: e.target.value } : x)) })}
                    />
                  </div>
                  <IconButton
                    label={`Quitar la ventaja ${i + 1}`}
                    className="mt-1"
                    onClick={() => setHome({ perks: home.perks.filter((_, n) => n !== i) })}
                  >
                    <Trash2 className="size-[18px]" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={home.perks.length >= MAX_PERKS}
            onClick={() => setHome({ perks: [...home.perks, { title: "", text: "" }] })}
          >
            <Plus className="size-4" aria-hidden />
            Agregar ventaja
          </Button>
        </Card>
      </div>

      <SaveBar>
        <ButtonLink href="/" variant="secondary" external>
          Ver tienda
          <ExternalLink className="size-4" aria-hidden />
        </ButtonLink>
        <Button
          loading={save.isPending}
          onClick={() => {
            // Las ventajas sin título ni texto no se guardan.
            const clean: Settings = { ...s, home: { ...home, perks: home.perks.filter((p) => p.title.trim() || p.text.trim()) } };
            setS(clean);
            save.mutate(clean);
          }}
        >
          Guardar portada
        </Button>
      </SaveBar>
    </>
  );
}
