import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'border-line bg-surface text-muted',
      success: 'border-success/30 bg-success-50 text-success',
      warning: 'border-warning-icon/40 bg-warning-50 text-warning',
      danger: 'border-danger/30 bg-danger-50 text-danger',
      info: 'border-tech/30 bg-tech-50 text-tech',
      demo: 'border-petrol/40 bg-white text-petrol-text',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
