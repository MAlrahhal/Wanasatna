'use client';

import { useEffect, useState } from 'react';
import { HomeBrandLogo } from '@/components/home/home-brand-logo';
import { HOME_SECTIONS, scrollToHomeSection } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

type HomeNavbarProps = {
  onLoginClick: () => void;
  onCreateRoomClick: () => void;
};

const navLinks = [
  { label: 'الرئيسية', sectionId: HOME_SECTIONS.top },
  { label: 'الألعاب', sectionId: HOME_SECTIONS.games },
  { label: 'الأسئلة الشائعة', sectionId: HOME_SECTIONS.faq },
  { label: 'تواصل معنا', sectionId: HOME_SECTIONS.contact },
] as const;

export function HomeNavbar({ onLoginClick, onCreateRoomClick }: HomeNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 8);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    function handleResize() {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMenuOpen]);

  function handleNavClick(sectionId: (typeof HOME_SECTIONS)[keyof typeof HOME_SECTIONS]) {
    setIsMobileMenuOpen(false);
    scrollToHomeSection(sectionId);
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-all duration-200',
        isScrolled
          ? 'border-[#E2E8F0] bg-white/95 shadow-sm backdrop-blur-sm'
          : 'border-transparent bg-[#F8FAFC]/80 backdrop-blur-sm',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => handleNavClick(HOME_SECTIONS.top)}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 focus-visible:ring-offset-2"
        >
          <HomeBrandLogo size="sm" />
        </button>

        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => handleNavClick(link.sectionId)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition-colors',
                'hover:bg-[#EFF6FF] hover:text-[#2563EB]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 focus-visible:ring-offset-2',
              )}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={onLoginClick}
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-[#64748B] transition-colors',
              'hover:bg-[#F1F5F9] hover:text-[#0F172A]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 focus-visible:ring-offset-2',
            )}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={onCreateRoomClick}
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-xl bg-[#3B82F6] px-4 text-sm font-semibold text-white transition-colors',
              'hover:bg-[#2563EB]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 focus-visible:ring-offset-2',
            )}
          >
            إنشاء غرفة
          </button>
        </div>

        <button
          type="button"
          aria-expanded={isMobileMenuOpen}
          aria-controls="home-mobile-menu"
          aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          className={cn(
            'inline-flex size-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A] lg:hidden',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 focus-visible:ring-offset-2',
          )}
        >
          {isMobileMenuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
      </div>

      <div
        id="home-mobile-menu"
        hidden={!isMobileMenuOpen}
        className={cn(
          'border-t border-[#E2E8F0] bg-white lg:hidden',
          isMobileMenuOpen ? 'block' : 'hidden',
        )}
      >
        <nav aria-label="التنقل للجوال" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
          {navLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => handleNavClick(link.sectionId)}
              className="flex items-center gap-2 rounded-xl px-3 py-3 text-start text-sm font-medium text-[#0F172A] hover:bg-[#EFF6FF]"
            >
              {link.label}
            </button>
          ))}
          <div className="mt-2 grid grid-cols-1 gap-2 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLoginClick();
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#64748B]"
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onCreateRoomClick();
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#3B82F6] text-sm font-semibold text-white"
            >
              إنشاء غرفة
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
