import { Fragment } from "react";
import { useParams } from "wouter";
import { ChevronDown } from "lucide-react";
import type { Block } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { ButtonLink, EmptyState, Spinner, cx } from "@/components/ui";

/** Párrafos separados por una línea en blanco; los saltos simples se respetan. */
function Prose({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={cx("space-y-4 text-[19px] leading-[1.55] text-ink-2", className)}>
      {paras.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j, arr) => (
            <Fragment key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "texto":
      return (
        <section className={cx("mx-auto max-w-[760px]", block.align === "centro" && "text-center")}>
          {block.title && <h2 className="headline text-[clamp(1.9rem,3.6vw,2.75rem)]">{block.title}</h2>}
          {block.body && <Prose text={block.body} className={block.title ? "mt-5" : undefined} />}
        </section>
      );
    case "imagen":
      if (!block.url) return null;
      return (
        <figure>
          <img src={block.url} alt={block.caption} loading="lazy" className="w-full rounded-panel bg-mist object-cover" />
          {block.caption && <figcaption className="mt-3 text-center text-[14px] text-ink-2">{block.caption}</figcaption>}
        </figure>
      );
    case "imagen_texto":
      return (
        <section className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className={cx("aspect-[4/5] overflow-hidden rounded-panel bg-mist", block.imageSide === "derecha" && "md:order-2")}>
            {block.url && <img src={block.url} alt="" loading="lazy" className="size-full object-cover" />}
          </div>
          <div>
            {block.title && <h2 className="headline text-[clamp(1.9rem,3.6vw,2.75rem)]">{block.title}</h2>}
            {block.body && <Prose text={block.body} className="mt-5" />}
          </div>
        </section>
      );
    case "preguntas":
      return (
        <section className="mx-auto max-w-[760px]">
          {block.title && <h2 className="headline mb-6 text-[clamp(1.9rem,3.6vw,2.75rem)]">{block.title}</h2>}
          <div className="border-b border-line">
            {block.items.map((item, i) => (
              <details key={i} className="group border-t border-line">
                <summary className="flex list-none items-center justify-between gap-6 py-6 text-[21px] font-semibold tracking-[-0.025em] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-5 shrink-0 text-ink-2 transition-transform duration-300 group-open:rotate-180" aria-hidden />
                </summary>
                <Prose text={item.a} className="pb-7 text-[17px]" />
              </details>
            ))}
          </div>
        </section>
      );
    case "boton":
      return (
        <section className="rounded-panel bg-mist px-6 py-16 text-center sm:py-20">
          {block.title && <h2 className="headline mx-auto max-w-[18ch] text-[clamp(2rem,4.4vw,3.5rem)]">{block.title}</h2>}
          {block.body && <p className="mx-auto mt-4 max-w-[48ch] text-[19px] text-ink-2">{block.body}</p>}
          {block.label && block.href && (
            <div className="mt-8">
              <ButtonLink href={block.href} size="lg">
                {block.label}
              </ButtonLink>
            </div>
          )}
        </section>
      );
  }
}

export function NotFound() {
  return (
    <div className="wrap pt-[160px]">
      <EmptyState title="Esta página no existe" text="Puede que el enlace esté mal escrito o que la página haya cambiado de dirección.">
        <ButtonLink href="/">Ir al inicio</ButtonLink>
      </EmptyState>
    </div>
  );
}

export default function Page() {
  const { slug } = useParams<{ slug?: string }>();
  const q = trpc.store.page.useQuery({ slug: slug ?? "" }, { enabled: Boolean(slug) });

  if (!slug) return <NotFound />;
  if (q.isLoading) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!q.data) return <NotFound />;

  const page = q.data;
  return (
    <article className="wrap pt-[124px]">
      <header className="mx-auto max-w-[760px]">
        <h1 className="display text-[clamp(2.8rem,8vw,6rem)]">{page.title}</h1>
        {page.intro && <p className="mt-5 text-[21px] leading-snug text-ink-2 sm:text-[24px]">{page.intro}</p>}
      </header>
      <div className="mt-14 space-y-16 sm:mt-20 sm:space-y-24">
        {page.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    </article>
  );
}
