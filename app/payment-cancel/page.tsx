import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <main className="min-h-screen bg-[#101020] px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-white/50">
          ← Back to Home
        </Link>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-8">
          <p className="mb-4 inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
            Payment Not Completed
          </p>

          <h1 className="text-5xl font-bold">Payment cancelled</h1>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Your payment was not completed. No credits were added to your
            SoulLoop account.
          </p>

          <p className="mt-4 text-sm leading-6 text-white/50">
            You can return to the Credits page and choose a package again when
            you are ready.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/credits"
              className="rounded-full bg-white px-8 py-4 text-center font-semibold text-black"
            >
              Choose Credits Again
            </Link>

            <Link
              href="/chat"
              className="rounded-full border border-white/20 px-8 py-4 text-center font-semibold text-white"
            >
              Back to Chat
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}