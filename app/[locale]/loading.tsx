export default function LocaleLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="mx-auto w-full max-w-[1120px] animate-pulse space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="h-10 w-64 rounded-2xl bg-white/[0.06]" />
          <div className="h-12 w-48 rounded-2xl bg-brand/20" />
        </div>

        <div className="rounded-[20px] border border-border bg-white/[0.03] p-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="h-12 rounded-[14px] bg-white/[0.05]" />
            <div className="h-12 rounded-[14px] bg-white/[0.05]" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface h-44 bg-white/[0.03]" />
          <div className="surface h-44 bg-white/[0.03]" />
          <div className="surface h-44 bg-white/[0.03]" />
        </div>

        <div className="surface h-20 bg-white/[0.03]" />

        <div className="space-y-4">
          <div className="h-8 w-40 rounded-xl bg-white/[0.06]" />
          <div className="surface h-24 bg-white/[0.03]" />
          <div className="surface h-24 bg-white/[0.03]" />
        </div>
      </section>
    </main>
  );
}
