import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-[var(--gutter)] text-center">
      <div>
        <p className="t-caption uppercase">404</p>
        <h1 className="t-display mt-2"><span className="brand-text">Line&apos;s dead.</span></h1>
        <p className="t-body mt-3 mb-6">That page isn&apos;t here. The games are, though.</p>
        <Link href="/" className="btn btn-cta">Back to the library</Link>
      </div>
    </main>
  );
}
