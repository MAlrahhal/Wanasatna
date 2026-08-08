'use client';

import type { DrawGuessTool } from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  { id: 'black', value: '#111827', label: 'أسود' },
  { id: 'red', value: '#DC2626', label: 'أحمر' },
  { id: 'blue', value: '#2563EB', label: 'أزرق' },
  { id: 'green', value: '#16A34A', label: 'أخضر' },
  { id: 'orange', value: '#EA580C', label: 'برتقالي' },
  { id: 'purple', value: '#7C3AED', label: 'بنفسجي' },
  { id: 'brown', value: '#92400E', label: 'بني' },
] as const;

const BRUSH_SIZES = [4, 8, 16] as const;

export type DrawingToolbarProps = {
  tool: DrawGuessTool;
  color: string;
  size: number;
  disabled?: boolean;
  isClearing?: boolean;
  onToolChange: (tool: DrawGuessTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onClear: () => void;
  className?: string;
};

export function DrawingToolbar({
  tool,
  color,
  size,
  disabled = false,
  isClearing = false,
  onToolChange,
  onColorChange,
  onSizeChange,
  onClear,
  className,
}: DrawingToolbarProps) {
  return (
    <div
      className={cn(
        'wanas-game-card flex flex-col gap-4 rounded-[1.25rem] p-4 sm:p-5',
        className,
      )}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tool === 'draw' ? 'primary' : 'outline'}
          disabled={disabled}
          onClick={() => onToolChange('draw')}
        >
          رسم
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tool === 'erase' ? 'primary' : 'outline'}
          disabled={disabled}
          onClick={() => onToolChange('erase')}
        >
          ممحاة
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={disabled}
          loading={isClearing}
          onClick={onClear}
          className="ms-auto"
        >
          مسح اللوحة
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-wanas-text-muted">الألوان</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((preset) => {
            const selected = color.toLowerCase() === preset.value.toLowerCase();

            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled || tool === 'erase'}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => onColorChange(preset.value)}
                className={cn(
                  'size-9 rounded-full border-2 transition-transform',
                  selected
                    ? 'scale-110 border-wanas-accent ring-2 ring-wanas-accent/30'
                    : 'border-[color:var(--wanas-game-card-border)]',
                  (disabled || tool === 'erase') && 'opacity-50',
                )}
                style={{ backgroundColor: preset.value }}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-wanas-text-muted">حجم الفرشاة</p>
        <div className="flex flex-wrap gap-2">
          {BRUSH_SIZES.map((brushSize) => (
            <Button
              key={brushSize}
              type="button"
              size="sm"
              variant={size === brushSize ? 'primary' : 'outline'}
              disabled={disabled}
              onClick={() => onSizeChange(brushSize)}
            >
              {brushSize}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
