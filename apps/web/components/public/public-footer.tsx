import Link from 'next/link';
import { PublicBrandLogo } from '@/components/public/public-brand-logo';
import { BRAND_NAME_AR, BRAND_TAGLINE_AR } from '@/lib/public/brand';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { cn } from '@/lib/utils';

const footerLinks = [
  { href: PUBLIC_ROUTES.home, label: 'الرئيسية' },
  { href: PUBLIC_ROUTES.games, label: 'الألعاب' },
  { href: PUBLIC_ROUTES.faq, label: 'الأسئلة الشائعة' },
  { href: PUBLIC_ROUTES.contact, label: 'تواصل معنا' },
  { href: PUBLIC_ROUTES.privacy, label: 'سياسة الخصوصية' },
  { href: PUBLIC_ROUTES.terms, label: 'الشروط والأحكام' },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-wanas-border bg-wanas-brand-navy text-wanas-text-on-brand mt-auto border-t pb-6 pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <PublicBrandLogo size="md" />
            <p className="max-w-sm text-sm leading-7 text-white/80">{BRAND_TAGLINE_AR}</p>
          </div>

          <nav
            aria-label="روابط تذييل وناستنا"
            className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3"
          >
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium text-white/75 transition-colors hover:text-white',
                  'focus-visible:ring-offset-wanas-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/60 sm:text-start">
          © {new Date().getFullYear()} {BRAND_NAME_AR}. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
