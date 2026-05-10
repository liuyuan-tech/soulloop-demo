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
            At this demo stage, SoulLoop does not yet provide user accounts,
            payment processing, or long-term personal history storage.
          </p>

          <p>
            When future account and payment features are added, this policy
            should be reviewed and updated before accepting real payments.
          </p>

          <p>
            SoulLoop does not sell personal information.
          </p>
        </div>
      </section>
    </main>
  );
}