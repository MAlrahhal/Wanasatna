import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-extrabold text-wanas-text-primary">الصفحة غير موجودة</h1>
      <p className="mt-3 text-sm leading-7 text-wanas-text-secondary">
        تعذر العثور على هذه الصفحة.
      </p>
    </main>
  );
}
