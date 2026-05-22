import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-white/50">
          Back to Home
        </Link>

        <div className="mt-10">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            Contact
          </p>

          <h1 className="text-5xl font-bold">Contact SoulLoop</h1>

          <div className="mt-8 space-y-6 text-sm leading-7 text-white/65">
            <p>
              For payment questions, account access, refund review, or product
              support, contact the SoulLoop team by email.
            </p>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-white/40">Support Email</p>
              <p className="mt-2 break-all text-lg font-semibold text-white">
                support@soulloop.app
              </p>
            </div>

            <p>
              Include your SoulLoop account email, payment provider, and payment
              reference when contacting us about a credit purchase.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
