'use client';

import type { DrawGuessTool } from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  { id: 'black', value: '#111827', label: 'أسود' },
  { id: 'white', value: '#FFFFFF', label: 'أبيض' },
  { id: 'gray', value: '#9CA3AF', label: 'رمادي' },
  { id: 'red', value: '#EF4444', label: 'أحمر' },
  { id: 'dark-red', value: '#991B1B', label: 'أحمر غامق' },
  { id: 'orange', value: '#F97316', label: 'برتقالي' },
  { id: 'yellow', value: '#EAB308', label: 'أصفر' },
  { id: 'green', value: '#22C55E', label: 'أخضر' },
  { id: 'light-green', value: '#86EFAC', label: 'أخضر فاتح' },
  { id: 'blue', value: '#3B82F6', label: 'أزرق' },
  { id: 'dark-blue', value: '#1E3A8A', label: 'أزرق غامق' },
  { id: 'light-blue', value: '#93C5FD', label: 'أزرق فاتح' },
  { id: 'purple', value: '#A855F7', label: 'بنفسجي' },
  { id: 'pink', value: '#EC4899', label: 'وردي' },
  { id: 'brown', value: '#92400E', label: 'بني' },
] as const;

const BRUSH_SIZES = [4, 8, 16] as const;

export type DrawingToolbarProps = {
  tool: DrawGuessTool;
  color: string;
  size: number;
  disabled?: boolean;
  isClearing?: boolean;
  isUndoing?: boolean;
  onToolChange: (tool: DrawGuessTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo?: () => void;
  onClear?: () => void;
  className?: string;
};
export function DrawingToolbar({
  tool,
  color,
  size,
  disabled = false,
  isClearing = false,
  isUndoing = false,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear,
  className,
}: DrawingToolbarProps) {
  return (
    <div
      className={cn(
        'wanas-game-card flex flex-col gap-3 rounded-[1.25rem] p-3 sm:gap-4 sm:p-5',
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
        {onUndo ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            loading={isUndoing}
            onClick={onUndo}
          >
            تراجع
          </Button>
        ) : null}
        {onClear ? (
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
        ) : null}
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
                  'size-9 shrink-0 rounded-full border-2 transition-transform sm:size-10',
                  selected
                    ? 'scale-110 border-wanas-accent ring-2 ring-wanas-accent/30'
                    : 'border-[color:var(--wanas-game-card-border)]',
                  preset.value.toLowerCase() === '#ffffff' && 'shadow-inner',
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
