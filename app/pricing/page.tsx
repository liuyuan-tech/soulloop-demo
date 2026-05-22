import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <h1 className="mt-10 text-center text-5xl font-bold">Pricing</h1>

        <p className="mx-auto mt-6 max-w-2xl text-center leading-8 text-white/60">
          SoulLoop uses credits for AI-powered symbolic reading and
          self-reflection entertainment experiences. Available checkout methods
          may include Alipay and Stripe depending on your region.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            ["Starter", "$4.99", "100 Mystic Credits", "For casual exploration."],
            ["Seeker", "$9.99", "250 Mystic Credits", "For deeper weekly use."],
            ["Mystic", "$19.99", "700 Mystic Credits", "For frequent readings."],
          ].map(([name, price, credits, desc]) => (
            <div
              key={name}
              className="rounded-3xl border border-white/10 bg-white/5 p-8"
            >
              <h2 className="text-2xl font-semibold">{name}</h2>
              <p className="mt-4 text-4xl font-bold">{price}</p>
              <p className="mt-4 text-white/80">{credits}</p>
              <p className="mt-3 text-white/50">{desc}</p>

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
          <h2 className="text-2xl font-bold">Planned credit usage</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Quick Reading", "3 credits"],
              ["Standard Reading", "8 credits"],
              ["Deep Reading", "20 credits"],
              ["Follow-up Question", "5 credits"],
              ["Love / Career / Money", "8–20 credits"],
              ["Daily Energy", "3–5 credits"],
            ].map(([item, cost]) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <p className="font-semibold">{item}</p>
                <p className="mt-2 text-white/50">{cost}</p>
              </div>
            ))}
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
