'use client';

import { useId, useState } from 'react';
import type { FaqCategory, FaqItem } from '@/lib/public/faq-data';
import { faqCategories, faqItems } from '@/lib/public/faq-data';
import { cn } from '@/lib/utils';

type FAQAccordionProps = {
  grouped?: boolean;
};

export function FAQAccordion({ grouped = true }: FAQAccordionProps) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);
  const [activeCategory, setActiveCategory] = useState<FaqCategory | 'all'>('all');

  const filteredItems =
    grouped && activeCategory !== 'all'
      ? faqItems.filter((item) => item.category === activeCategory)
      : faqItems;

  return (
    <div className="space-y-6">
      {grouped ? (
        <div className="flex flex-wrap gap-2">
          <CategoryPill
            label="الكل"
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          {faqCategories.map((cat) => (
            <CategoryPill
              key={cat.id}
              label={cat.label}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <FaqAccordionItem
            key={item.id}
            item={item}
            baseId={baseId}
            isOpen={openId === item.id}
            onToggle={() => setOpenId(openId === item.id ? null : item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30 focus-visible:ring-offset-2',
        active
          ? 'bg-wanas-accent text-[color:var(--wanas-background)] shadow-sm'
          : 'bg-wanas-surface text-wanas-text-secondary hover:bg-wanas-accent-soft',
      )}
    >
      {label}
    </button>
  );
}

function FaqAccordionItem({
  item,
  baseId,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  baseId: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const buttonId = `${baseId}-${item.id}-btn`;
  const panelId = `${baseId}-${item.id}-panel`;

  return (
    <article className="overflow-hidden rounded-[20px] border border-wanas-border bg-wanas-surface shadow-sm">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(
            'flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-sm font-bold text-wanas-text-primary sm:text-base',
            'hover:bg-wanas-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wanas-accent/30',
          )}
        >
          {item.question}
          <span
            aria-hidden
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full bg-wanas-primary-surface text-wanas-primary-dark transition-transform',
              isOpen && 'rotate-180',
            )}
          >
            ▾
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!isOpen}
        className="border-t border-wanas-background px-5 py-4 text-sm leading-7 text-wanas-text-muted"
      >
        {item.answer}
      </div>
    </article>
  );
}
