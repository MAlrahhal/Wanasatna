import { PageHero } from '@/components/public/page-hero';
import { PUBLIC_EXTERNAL_LINKS } from '@/lib/public/external-links';

export function ContactPageClient() {
  return (
    <main
      id="discord-invite-pending"
      className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-4xl items-center px-4 py-10 sm:px-6 sm:py-12"
    >
      <PageHero title="تواصل معنا" variant="compact" className="w-full">
        <p className="text-wanas-text-secondary mx-auto max-w-2xl text-sm leading-8 sm:text-base">
          عندك مشكلة، اقتراح، أو حاب تتواصل معنا؟
          <br />
          كل الدعم والتواصل مع فريق وناستنا يتم عبر سيرفر Discord الرسمي.
        </p>

        <a
          href={PUBLIC_EXTERNAL_LINKS.discordInvite}
          className="border-wanas-accent bg-wanas-accent hover:border-wanas-accent-hover hover:bg-wanas-accent-hover focus-visible:ring-wanas-accent/45 mt-6 inline-flex min-h-14 w-full max-w-sm items-center justify-center rounded-[var(--wanas-radius-control)] border px-6 text-base font-bold text-white shadow-[0_4px_0_var(--wanas-brand-navy)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_var(--wanas-brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none sm:w-auto sm:min-w-72"
        >
          انضم إلى ديسكورد وناستنا
        </a>
      </PageHero>
    </main>
  );
}
