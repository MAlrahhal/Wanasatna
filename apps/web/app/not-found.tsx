import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الصفحة غير موجودة',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-16 text-center outline-none"
    >
      <h1 className="text-wanas-text-primary text-3xl font-extrabold">الصفحة غير موجودة</h1>
      <p className="text-wanas-text-secondary mt-3 text-sm leading-7">
        تعذر العثور على هذه الصفحة.
      </p>
    </main>
  );
}
