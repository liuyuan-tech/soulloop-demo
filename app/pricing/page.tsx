import Link from "next/link";
import { READING_MODES } from "@/lib/readings/options";

const CREDIT_PACKAGES = [
  {
    name: "Starter",
    price: "$4.99",
    credits: 100,
    description: "Covers one paid-pack unlock plus at least two enhanced readings.",
  },
  {
    name: "Seeker",
    price: "$9.99",
    credits: 250,
    description: "Enough balance to unlock all paid packs and still keep usage credits.",
  },
  {
    name: "Mystic",
    price: "$19.99",
    credits: 700,
    description: "Built for repeat usage, gifting, and higher-frequency reading behavior.",
  },
];

export default function PricingPage() {
  const paidModes = READING_MODES.filter((mode) => mode.status !== "Included");

  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <h1 className="mt-10 text-center text-5xl font-bold">Pricing</h1>

        <p className="mx-auto mt-6 max-w-2xl text-center leading-8 text-white/60">
          SoulLoop uses a two-step credit model: buy credits, unlock any paid
          mode pack once, then spend credits only when you actually generate a
          reading. No subscription is required for the launch version.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CREDIT_PACKAGES.map((item) => (
            <div
              key={item.name}
              className="rounded-3xl border border-white/10 bg-white/5 p-8"
            >
              <h2 className="text-2xl font-semibold">{item.name}</h2>
              <p className="mt-4 text-4xl font-bold">{item.price}</p>
              <p className="mt-4 text-white/80">{item.credits} SoulLoop credits</p>
              <p className="mt-3 text-white/50">{item.description}</p>
              <p className="mt-4 text-sm leading-6 text-white/45">
                About {Math.floor(item.credits / 8)} Eastern Wisdom readings, or
                enough to combine unlocks with paid-mode usage.
              </p>

              <Link
                href="/credits"
                className="mt-8 block w-full rounded-full bg-white px-6 py-3 text-center font-semibold text-black"
              >
                Buy Credits
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-bold">Reading mode economics</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {READING_MODES.map((mode) => (
              <div
                key={mode.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold">{mode.label}</p>
                  <span className="text-sm text-white/45">{mode.status}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {mode.description}
                </p>
                <div className="mt-4 grid gap-2 text-sm text-white/65">
                  <div className="flex items-center justify-between gap-4">
                    <span>Unlock</span>
                    <span className="font-semibold text-white">
                      {mode.unlockCost > 0 ? `${mode.unlockCost} credits once` : "Included"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Each reading</span>
                    <span className="font-semibold text-white">
                      {mode.creditCost} credits
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-white/35">
              Commercial loop
            </p>
            <p className="mt-3 leading-7 text-white/60">
              Eastern Wisdom gets users into the product at low cost. Paid packs
              create a one-time upgrade moment, then ongoing reading usage drives
              repeat credit purchases instead of a mandatory subscription.
            </p>
            <p className="mt-3 text-sm leading-6 text-white/45">
              Highest unlock threshold today:{" "}
              {Math.max(...paidModes.map((mode) => mode.unlockCost))} credits.
            </p>
          </div>
        </div>

        <p className="mt-8 text-sm leading-6 text-white/45">
          SoulLoop readings are for entertainment and self-reflection only. They
          are not medical, legal, financial, or professional advice.
        </p>
      </section>
    </main>
  );
}
