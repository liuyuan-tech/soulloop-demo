import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#101020] text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
          AI Eastern Wisdom Reflection
        </p>

        <h1 className="max-w-5xl text-5xl font-bold leading-tight md:text-7xl">
          Ask life questions through Eastern wisdom.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
          SoulLoop transforms your questions into symbolic reflections inspired
          by I Ching-style thinking, Bagua, Yin-Yang, Five Elements, and
          Zi Wei Dou Shu-style life themes.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/chat"
            className="rounded-full bg-white px-8 py-4 font-semibold text-black"
          >
            Try SoulLoop Free
          </Link>

          <Link
            href="/pricing"
            className="rounded-full border border-white/20 px-8 py-4 font-semibold text-white"
          >
            View Pricing
          </Link>
        </div>

        <p className="mt-10 max-w-2xl text-sm text-white/40">
          For entertainment and self-reflection only. SoulLoop does not provide
          medical, legal, financial, psychological, or professional advice.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-4xl font-bold">
          What you can ask SoulLoop
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            [
              "Love & Relationships",
              "Explore emotional timing, communication patterns, and relationship uncertainty.",
            ],
            [
              "Career & Decisions",
              "Reflect on timing, direction, strengths, risk, and next steps.",
            ],
            [
              "Money & Growth",
              "Look at wealth questions through discipline, value creation, and long-term cycles.",
            ],
            [
              "Dream Interpretation",
              "Read dreams as emotional and symbolic messages, not fixed predictions.",
            ],
            [
              "Daily Energy",
              "Start the day with a symbolic reflection and practical focus.",
            ],
            [
              "Self-Discovery",
              "Understand inner patterns, recurring tensions, and personal growth themes.",
            ],
          ].map(([title, text]) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-7 text-white/60">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
          <h2 className="text-4xl font-bold">How it works</h2>

          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              ["1", "Choose your topic"],
              ["2", "Ask your question"],
              ["3", "Select tone and depth"],
              ["4", "Receive your SoulLoop reading"],
            ].map(([step, text]) => (
              <div key={step} className="rounded-3xl bg-black/20 p-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-bold text-black">
                  {step}
                </div>
                <p className="text-white/70">{text}</p>
              </div>
            ))}
          </div>

          <Link
            href="/chat"
            className="mt-10 inline-block rounded-full bg-white px-8 py-4 font-semibold text-black"
          >
            Start a Reading
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-12 text-sm text-white/40">
        <div className="flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <p>© 2026 SoulLoop. All rights reserved.</p>

          <div className="flex gap-6">
            <Link href="/pricing">Pricing</Link>
            <Link href="/disclaimer">Disclaimer</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}