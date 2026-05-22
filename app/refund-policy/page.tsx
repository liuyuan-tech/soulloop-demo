import Link from "next/link";

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-white/50">
          Back to Home
        </Link>

        <div className="mt-10">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            SoulLoop Policy
          </p>

          <h1 className="text-5xl font-bold">Refund Policy</h1>

          <div className="mt-8 space-y-6 text-sm leading-7 text-white/65">
            <p>
              SoulLoop is an AI-powered symbolic reading and self-reflection
              entertainment product. Credits are used to generate digital
              reading experiences.
            </p>

            <p>
              If a payment succeeds but credits are not delivered because of a
              technical issue, contact support with the payment reference and
              SoulLoop account email. We will review the transaction and either
              deliver the missing credits or arrange an appropriate refund.
            </p>

            <p>
              Refunds are generally not available after credits have been used
              to generate a reading, unless required by applicable law or caused
              by a verified technical failure.
            </p>

            <p>
              SoulLoop readings are for entertainment and self-reflection. They
              are not medical, legal, financial, or professional advice.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
