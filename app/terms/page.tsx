import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <h1 className="mt-10 text-5xl font-bold">Terms of Service</h1>

        <div className="mt-8 space-y-6 leading-8 text-white/70">
          <p>
            By using SoulLoop, you agree to use the service for entertainment,
            symbolic reflection, and self-discovery only.
          </p>

          <p>
            SoulLoop does not guarantee the accuracy, completeness, or outcome of
            any reading.
          </p>

          <p>
            You agree not to rely on SoulLoop as the sole basis for important
            life decisions, including medical, legal, financial, psychological,
            or professional matters.
          </p>

          <p>
            Credits are digital product credits used inside SoulLoop. Payment
            completion, credit delivery, and referral reward creation are handled
            through verified payment provider confirmations.
          </p>

          <p>
            Referral rewards and withdrawals may be subject to review,
            cancellation, or reversal if abuse, fraud, refunds, chargebacks, or
            policy violations are detected.
          </p>
        </div>
      </section>
    </main>
  );
}
