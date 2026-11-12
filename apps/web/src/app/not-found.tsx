import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid-dots flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-7xl font-semibold text-signal md:text-8xl">
        404
      </p>
      <p className="label mt-4 text-bone-3">page not found</p>
      <h1 className="mt-6 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">
        Ye page exist hi nahi karta — shayad link dead ho gaya.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-bone-2">
        Tension nahi — autopilot waise bhi 24/7 chal raha hai. Neeche se
        shuru karo.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-signal px-6 py-3">
          ← Home pe wapas
        </Link>
        <Link href="/features" className="btn-ghost px-6 py-3">
          Features dekho
        </Link>
      </div>
    </div>
  );
}
