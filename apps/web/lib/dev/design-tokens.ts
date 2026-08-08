export type DesignTokenSwatch = {
  name: string;
  cssVar: string;
  tailwindClass?: string;
};

export type DesignTokenGroup = {
  title: string;
  tokens: DesignTokenSwatch[];
};

export const designTokenGroups: DesignTokenGroup[] = [
  {
    title: 'Brand',
    tokens: [
      { name: 'primary', cssVar: '--wanas-primary', tailwindClass: 'bg-wanas-primary' },
      { name: 'primary-dark', cssVar: '--wanas-primary-dark', tailwindClass: 'bg-wanas-primary-dark' },
      { name: 'primary-darker', cssVar: '--wanas-primary-darker', tailwindClass: 'bg-wanas-primary-darker' },
      { name: 'primary-soft', cssVar: '--wanas-primary-soft', tailwindClass: 'bg-wanas-primary-soft' },
    ],
  },
  {
    title: 'Accent',
    tokens: [
      { name: 'accent', cssVar: '--wanas-accent', tailwindClass: 'bg-wanas-accent' },
      { name: 'accent-hover', cssVar: '--wanas-accent-hover', tailwindClass: 'bg-wanas-accent-hover' },
      { name: 'accent-soft', cssVar: '--wanas-accent-soft', tailwindClass: 'bg-wanas-accent-soft' },
    ],
  },
  {
    title: 'Success',
    tokens: [
      { name: 'success', cssVar: '--wanas-success', tailwindClass: 'bg-wanas-success' },
      { name: 'success-dark', cssVar: '--wanas-success-dark', tailwindClass: 'bg-wanas-success-dark' },
      { name: 'success-surface', cssVar: '--wanas-success-surface', tailwindClass: 'bg-wanas-success-surface' },
    ],
  },
  {
    title: 'Warning',
    tokens: [
      { name: 'warning', cssVar: '--wanas-warning', tailwindClass: 'bg-wanas-warning' },
      { name: 'warning-dark', cssVar: '--wanas-warning-dark', tailwindClass: 'bg-wanas-warning-dark' },
      { name: 'warning-surface', cssVar: '--wanas-warning-surface', tailwindClass: 'bg-wanas-warning-surface' },
    ],
  },
  {
    title: 'Error',
    tokens: [
      { name: 'error', cssVar: '--wanas-error', tailwindClass: 'bg-wanas-error' },
      { name: 'error-border', cssVar: '--wanas-error-border', tailwindClass: 'bg-wanas-error-border' },
      { name: 'error-surface', cssVar: '--wanas-error-surface', tailwindClass: 'bg-wanas-error-surface' },
    ],
  },
  {
    title: 'Surface',
    tokens: [
      { name: 'surface', cssVar: '--wanas-surface', tailwindClass: 'bg-wanas-surface' },
      { name: 'surface-soft', cssVar: '--wanas-surface-soft', tailwindClass: 'bg-wanas-surface-soft' },
      { name: 'panel-soft', cssVar: '--wanas-panel-soft', tailwindClass: 'bg-wanas-panel-soft' },
    ],
  },
  {
    title: 'Background',
    tokens: [
      { name: 'background', cssVar: '--wanas-background', tailwindClass: 'bg-wanas-background' },
      { name: 'background-strong', cssVar: '--wanas-background-strong', tailwindClass: 'bg-wanas-background-strong' },
      { name: 'hero', cssVar: '--wanas-hero', tailwindClass: 'bg-wanas-hero' },
      { name: 'navbar', cssVar: '--wanas-navbar', tailwindClass: 'bg-wanas-navbar' },
    ],
  },
  {
    title: 'Border',
    tokens: [
      { name: 'border', cssVar: '--wanas-border', tailwindClass: 'bg-wanas-border' },
      { name: 'border-muted', cssVar: '--wanas-border-muted', tailwindClass: 'bg-wanas-border-muted' },
      { name: 'border-subtle', cssVar: '--wanas-border-subtle', tailwindClass: 'bg-wanas-border-subtle' },
    ],
  },
  {
    title: 'Text',
    tokens: [
      { name: 'text-primary', cssVar: '--wanas-text-primary', tailwindClass: 'bg-wanas-text-primary' },
      { name: 'text-secondary', cssVar: '--wanas-text-secondary', tailwindClass: 'bg-wanas-text-secondary' },
      { name: 'text-muted', cssVar: '--wanas-text-muted', tailwindClass: 'bg-wanas-text-muted' },
    ],
  },
];
