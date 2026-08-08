'use client';

import { HomeBrandLogo } from '@/components/home/home-brand-logo';
import { HOME_SECTIONS, scrollToHomeSection } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

const footerLinks = [
  { label: 'الرئيسية', sectionId: HOME_SECTIONS.top },
  { label: 'الألعاب', sectionId: HOME_SECTIONS.games },
  { label: 'الأسئلة الشائعة', sectionId: HOME_SECTIONS.faq },
  { label: 'تواصل معنا', sectionId: HOME_SECTIONS.contact },
  { label: 'بريميوم', sectionId: HOME_SECTIONS.premium },
] as const;

export function HomeFooter() {
  return (
    <footer className="mt-4 border-t border-[#E2E8F0] pt-10 pb-4">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="space-y-4">
          <HomeBrandLogo size="md" />
          <p className="max-w-sm text-sm leading-7 text-[#64748B]">
            منصة ألعاب جماعية عربية — العب مع أصدقائك مباشرة من المتصفح.
          </p>
        </div>

        <nav aria-label="روابط التذييل" className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {footerLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => scrollToHomeSection(link.sectionId)}
              className={cn(
                'text-start text-sm text-[#64748B] transition-colors hover:text-[#2563EB]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 focus-visible:ring-offset-2',
              )}
            >
              {link.label}
            </button>
          ))}
          <a
            href="#"
            className="text-sm text-[#64748B] transition-colors hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 focus-visible:ring-offset-2"
          >
            سياسة الخصوصية
          </a>
          <a
            href="#"
            className="text-sm text-[#64748B] transition-colors hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 focus-visible:ring-offset-2"
          >
            الشروط والأحكام
          </a>
        </nav>
      </div>

      <p className="mt-10 border-t border-[#E2E8F0] pt-6 text-center text-xs leading-6 text-[#94A3B8] sm:text-start">
        © {new Date().getFullYear()} ونساتنا. جميع الحقوق محفوظة.
      </p>
    </footer>
  );
}
