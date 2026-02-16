'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type DateRange = 'today' | '7d' | '30d' | '90d' | 'custom';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange, customDates?: { start: Date; end: Date }) => void;
  className?: string;
}

const presets: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(value === 'custom');

  const handlePresetClick = (preset: DateRange) => {
    setShowCustom(false);
    onChange(preset);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange('custom', {
        start: new Date(customStart),
        end: new Date(customEnd),
      });
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex bg-dark-800/50 border border-white/10 rounded-lg p-1">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              value === preset.value && !showCustom
                ? 'bg-gold-500 text-black'
                : 'text-gray-400 hover:text-white'
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            showCustom
              ? 'bg-gold-500 text-black'
              : 'text-gray-400 hover:text-white'
          )}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-1.5 bg-dark-800/50 border border-white/10 rounded-lg text-sm text-white"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 bg-dark-800/50 border border-white/10 rounded-lg text-sm text-white"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 bg-gold-500 text-black text-sm font-medium rounded-lg disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
