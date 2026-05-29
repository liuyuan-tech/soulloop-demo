import Link from "next/link";

const elements = [
  ["Wood", "木", "Growth", "text-emerald-200"],
  ["Fire", "火", "Clarity", "text-red-200"],
  ["Earth", "土", "Stability", "text-amber-100"],
  ["Metal", "金", "Decision", "text-zinc-100"],
  ["Water", "水", "Flow", "text-sky-200"],
];

const themes = [
  ["Love", "Emotional timing, attraction, boundaries, and repair."],
  ["Career", "Momentum, capability, preparation, and visibility."],
  ["Money", "Resource discipline, patience, risk, and value creation."],
  ["Self", "Identity, habits, inner loops, and personal clarity."],
  ["Decision", "Pressure, tradeoffs, timing, and one reversible next step."],
  ["Relationship", "Communication, roles, mutual expectations, and trust."],
];

const process = [
  ["Profile", "Birth time, location, focus, and language shape the context."],
  ["Chart", "Bagua and Five Elements translate the question into structure."],
  ["Reason", "Modes cross-check the same question from different lenses."],
  ["Act", "Every answer ends with today's action and avoidance."],
];

const feedback = [
  [
    "Maya L.",
    "Beta user note",
    "The first sentence gave me a clear answer, then the reasoning made it feel grounded instead of vague.",
  ],
  [
    "Chen R.",
    "Prototype feedback",
    "I liked that it showed the Five Elements logic before giving advice. It felt more like a report than a chatbot.",
  ],
  [
    "Aria K.",
    "Beta user note",
    "The relationship reading did not overpromise. It helped me choose what to say today.",
  ],
  [
    "Jon M.",
    "Prototype feedback",
    "The daily action and avoidance sections are what made me want to come back tomorrow.",
  ],
  [
    "Yuki S.",
    "Beta user note",
    "The cross-check between Eastern Wisdom and Tarot made the answer feel less random.",
  ],
  [
    "Nora W.",
    "Prototype feedback",
    "The profile flow was short enough that I finished it before I started second-guessing.",
  ],
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#090b0a] text-[#f8f4ea]">
      <section className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(197,165,78,0.18),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(48,117,88,0.22),transparent_26%),linear-gradient(145deg,#070806_0%,#12100b_48%,#0a1210_100%)]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:64px_64px]" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="soul-bagua-scene">
            <div className="soul-bagua-ring">
              {["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"].map(
                (item, index) => (
                  <span
                    key={item}
                    className="soul-bagua-symbol"
                    style={{ transform: `rotate(${index * 45}deg)` }}
                  >
                    <span>{item}</span>
                  </span>
                )
              )}
            </div>
            <div className="soul-yinyang" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="soul-orbit soul-orbit-one" />
            <div className="soul-orbit soul-orbit-two" />
          </div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-7">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/" className="text-lg font-semibold tracking-wide">
              SoulLoop
            </Link>

            <div className="flex items-center gap-4 text-sm text-[#f8f4ea]/60">
              <Link href="/pricing" className="hover:text-[#f8f4ea]">
                Pricing
              </Link>
              <Link href="/login" className="hover:text-[#f8f4ea]">
                Log in
              </Link>
            </div>
          </nav>

          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="mb-5 inline-flex rounded-full border border-[#c9a64d]/35 bg-[#c9a64d]/10 px-4 py-2 text-sm text-[#f1d691]">
                AI Eastern Wisdom Engine
              </p>

              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] text-[#fffaf0] md:text-7xl">
                Ask life questions through BaZi-inspired reasoning.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#f8f4ea]/68">
                SoulLoop turns your profile, question history, Bagua movement,
                and Five Elements signals into direct answers, grounded
                reasoning, and action you can actually take today.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/profile"
                  className="rounded-full bg-[#f8f4ea] px-8 py-4 text-center font-semibold text-[#11100d]"
                >
                  Create Profile
                </Link>

                <Link
                  href="/chat"
                  className="rounded-full border border-[#f8f4ea]/18 px-8 py-4 text-center font-semibold text-[#f8f4ea]"
                >
                  Ask SoulLoop
                </Link>
              </div>

              <p className="mt-7 max-w-xl text-sm leading-6 text-[#f8f4ea]/42">
                For reflection and entertainment. SoulLoop does not make
                medical, legal, financial, or deterministic life claims.
              </p>
            </div>

            <div className="relative min-h-[520px]">
              <div className="absolute inset-x-0 top-2 mx-auto h-[520px] max-w-[520px] rounded-full border border-[#c9a64d]/20 bg-[#11130f]/55 shadow-[0_0_120px_rgba(197,166,77,0.18)]" />
              <div className="relative mx-auto grid max-w-[520px] gap-4 pt-12">
                {elements.map(([name, glyph, meaning, color], index) => (
                  <div
                    key={name}
                    className={`soul-element-row border border-[#f8f4ea]/10 bg-[#11130f]/78 p-5 ${color}`}
                    style={{ animationDelay: `${index * 180}ms` }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-current/30 bg-current/10 text-xl font-semibold">
                      {glyph}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-[#fffaf0]">
                        {name}
                      </p>
                      <p className="text-sm text-[#f8f4ea]/48">{meaning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f8f4ea] px-6 py-20 text-[#16130d]">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[#876b2d]">
                Reading Themes
              </p>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold md:text-5xl">
                A clean question interface for the moments users actually pay
                for.
              </h2>
            </div>

            <Link
              href="/chat"
              className="w-fit rounded-full bg-[#15140f] px-6 py-3 font-semibold text-[#f8f4ea]"
            >
              Open Themes
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {themes.map(([title, text]) => (
              <div
                key={title}
                className="rounded-lg border border-[#16130d]/12 bg-white/65 p-5"
              >
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-[#16130d]/60">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d1210] px-6 py-20 text-[#f8f4ea]">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm uppercase tracking-[0.18em] text-[#94c7a5]">
            Engine Flow
          </p>
          <h2 className="mt-3 max-w-3xl text-4xl font-semibold md:text-5xl">
            Show the reasoning path before asking users to trust the answer.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {process.map(([title, text], index) => (
              <div
                key={title}
                className="rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/5 p-5"
              >
                <p className="text-sm text-[#f1d691]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-[#f8f4ea]/58">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#11100d] py-18 text-[#f8f4ea]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[#f1d691]">
                Beta User Notes
              </p>
              <h2 className="mt-3 text-4xl font-semibold">
                Example feedback from product testing.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#f8f4ea]/45">
              These are generated prototype notes for layout testing and should
              be replaced with verified customer reviews after launch.
            </p>
          </div>
        </div>

        <div className="soul-testimonial-mask mt-10 overflow-hidden">
          <div className="soul-testimonial-track flex gap-4">
            {[...feedback, ...feedback].map(([name, label, text], index) => (
              <figure
                key={`${name}-${index}`}
                className="w-[320px] shrink-0 rounded-lg border border-[#f8f4ea]/10 bg-[#f8f4ea]/6 p-5"
              >
                <blockquote className="min-h-28 text-lg leading-7 text-[#f8f4ea]/78">
                  &ldquo;{text}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center justify-between gap-4 border-t border-[#f8f4ea]/10 pt-4">
                  <span className="font-semibold">{name}</span>
                  <span className="text-xs text-[#f8f4ea]/38">{label}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#090b0a] px-6 py-10 text-sm text-[#f8f4ea]/45">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-[#f8f4ea]/10 pt-8 md:flex-row md:items-center md:justify-between">
          <p>© 2026 SoulLoop. All rights reserved.</p>

          <div className="flex flex-wrap gap-5">
            <Link href="/pricing">Pricing</Link>
            <Link href="/disclaimer">Disclaimer</Link>
            <Link href="/refund-policy">Refund</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
