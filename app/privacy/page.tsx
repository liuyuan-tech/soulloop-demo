import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <h1 className="mt-10 text-5xl font-bold">Privacy Policy</h1>

        <div className="mt-8 space-y-6 leading-8 text-white/70">
          <p>
            This Privacy Policy explains how SoulLoop may collect and use
            information during the MVP demo stage.
          </p>

          <p>
            SoulLoop may process the questions you submit, selected reading
            options, language choices, tone preferences, and generated AI
            responses in order to provide the service.
          </p>

          <p>
            SoulLoop may use account, payment, credit balance, referral, and
            reading history data to operate the product and provide support.
          </p>

          <p>
            Payment details are processed by payment providers such as Alipay or
            Stripe. SoulLoop stores payment references and credit records, not
            full card numbers.
          </p>

          <p>
            SoulLoop does not sell personal information.
          </p>
        </div>
      </section>
    </main>
  );
}
