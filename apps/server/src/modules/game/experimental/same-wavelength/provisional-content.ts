export type SameWavelengthSpectrum = {
  id: string;
  leftLabel: string;
  rightLabel: string;
};

/** Temporary original Arabic pairs for closed playtests; not the final approved bank. */
export const SAME_WAVELENGTH_PROVISIONAL_SPECTRA: readonly SameWavelengthSpectrum[] = [
  { id: 'price', leftLabel: 'رخيص', rightLabel: 'غالي' },
  { id: 'temperature', leftLabel: 'بارد', rightLabel: 'حار' },
  { id: 'difficulty', leftLabel: 'سهل', rightLabel: 'صعب' },
  { id: 'speed', leftLabel: 'بطيء', rightLabel: 'سريع' },
  { id: 'noise', leftLabel: 'هادئ', rightLabel: 'صاخب' },
  { id: 'size', leftLabel: 'صغير', rightLabel: 'ضخم' },
  { id: 'familiarity', leftLabel: 'غريب', rightLabel: 'مألوف' },
  { id: 'risk', leftLabel: 'آمن', rightLabel: 'خطير' },
  { id: 'seriousness', leftLabel: 'خفيف', rightLabel: 'جدي' },
  { id: 'energy', leftLabel: 'خامل', rightLabel: 'نشيط' },
] as const;
