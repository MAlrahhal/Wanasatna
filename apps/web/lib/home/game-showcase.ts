export type HomeGameAvailability = 'available' | 'coming-soon';

export type HomeGameShowcase = {
  availability: HomeGameAvailability;
  accentClassName: string;
  iconClassName: string;
  hoverBorderClassName: string;
};

export const homeGameShowcaseById: Record<string, HomeGameShowcase> = {
  'bara-al-salafa': {
    availability: 'available',
    accentClassName: 'bg-[#EFF6FF] text-[#2563EB]',
    iconClassName: 'bg-[#DBEAFE] text-[#2563EB]',
    hoverBorderClassName: 'hover:border-[#93C5FD]',
  },
  'draw-guess': {
    availability: 'available',
    accentClassName: 'bg-[#FFF7ED] text-[#EA580C]',
    iconClassName: 'bg-[#FFEDD5] text-[#EA580C]',
    hoverBorderClassName: 'hover:border-[#FDBA74]',
  },
  'timing-challenge': {
    availability: 'available',
    accentClassName: 'bg-[#FEF2F2] text-[#DC2626]',
    iconClassName: 'bg-[#FEE2E2] text-[#DC2626]',
    hoverBorderClassName: 'hover:border-[#FCA5A5]',
  },
  'fast-answer': {
    availability: 'available',
    accentClassName: 'bg-[#EFF6FF] text-[#2563EB]',
    iconClassName: 'bg-[#DBEAFE] text-[#2563EB]',
    hoverBorderClassName: 'hover:border-[#93C5FD]',
  },
  'imposter-draw': {
    availability: 'available',
    accentClassName: 'bg-[#F5F3FF] text-[#7C3AED]',
    iconClassName: 'bg-[#EDE9FE] text-[#7C3AED]',
    hoverBorderClassName: 'hover:border-[#C4B5FD]',
  },
  'who-wrote-it': {
    availability: 'coming-soon',
    accentClassName: 'bg-[#F8FAFC] text-[#94A3B8]',
    iconClassName: 'bg-[#F1F5F9] text-[#94A3B8]',
    hoverBorderClassName: '',
  },
  judge: {
    availability: 'coming-soon',
    accentClassName: 'bg-[#F8FAFC] text-[#94A3B8]',
    iconClassName: 'bg-[#F1F5F9] text-[#94A3B8]',
    hoverBorderClassName: '',
  },
  marathon: {
    availability: 'coming-soon',
    accentClassName: 'bg-[#F8FAFC] text-[#94A3B8]',
    iconClassName: 'bg-[#F1F5F9] text-[#94A3B8]',
    hoverBorderClassName: '',
  },
};

export const defaultHomeGameShowcase: HomeGameShowcase = {
  availability: 'coming-soon',
  accentClassName: 'bg-[#F8FAFC] text-[#94A3B8]',
  iconClassName: 'bg-[#F1F5F9] text-[#94A3B8]',
  hoverBorderClassName: '',
};

export function getHomeGameShowcase(gameId: string): HomeGameShowcase {
  return homeGameShowcaseById[gameId] ?? defaultHomeGameShowcase;
}
