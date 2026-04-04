import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCategoryDetailData } from "@/lib/clues/repository";
import { clueCategories } from "@/lib/clues/types";

type Params = Promise<{ category: string }>;

export async function generateStaticParams() {
  return clueCategories.map((category) => ({
    category: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { category } = await params;
  const detail = await getCategoryDetailData(category);

  if (!detail) {
    return { title: "Kategori bulunamadi" };
  }

  return {
    description: detail.meta.description,
    title: `${detail.meta.label} clue kategorisi`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Params;
}) {
  const { category } = await params;
  const detail = await getCategoryDetailData(category);

  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <section className="rounded-[32px] border border-white/12 bg-white/6 p-6 backdrop-blur-xl">
          <Link
            href="/clues"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200"
          >
            Clue atlas
          </Link>
          <h1 className="mt-3 text-4xl font-semibold text-white">{detail.meta.label}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
            {detail.meta.description}
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {detail.clues.map((clue) => (
            <article key={clue.id} className="rounded-[24px] border border-white/12 bg-slate-950/62 p-5">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/clues/countries/${clue.countryCode}`}
                  className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-cyan-200"
                >
                  {clue.countryName}
                </Link>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Ayirt edicilik {clue.distinctiveness}/5
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">{clue.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-200">{clue.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
