'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { VideoStatus } from '@/lib/api';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- Button ----------------------------------------------------------------
// 44px minimum height on every variant, desktop included: the same component
// has to serve touch.
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-control text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-ground hover:bg-accent-hover border border-transparent',
  secondary: 'border border-surface-border text-ink hover:bg-surface font-medium',
  destructive: 'border border-status-failed/50 text-status-failed hover:bg-status-failed/10',
  ghost: 'text-ink-soft hover:text-ink hover:bg-surface font-medium border border-transparent',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: { variant?: ButtonVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} {...rest} />;
}

export function ButtonLink({
  href,
  variant = 'primary',
  className = '',
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

// --- Status ----------------------------------------------------------------
// Never colour alone: each state carries an icon and a word, and the four
// differ in lightness as well as hue so they survive greyscale.
const STATUS_META: Record<
  VideoStatus,
  { label: string; tint: string; icon: ReactNode }
> = {
  PENDING: {
    label: 'Queued',
    tint: 'bg-status-queued/15 border-status-queued/40 text-ink-soft',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  PROCESSING: {
    label: 'Processing',
    tint: 'bg-status-processing/15 border-status-processing/45 text-status-processing',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.2-8.6" />
      </svg>
    ),
  },
  COMPLETED: {
    label: 'Ready',
    tint: 'bg-status-ready/15 border-status-ready/45 text-status-ready',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  FAILED: {
    label: 'Failed',
    tint: 'bg-status-failed/15 border-status-failed/45 text-status-failed',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    ),
  },
  CANCELLED: {
    label: 'Cancelled',
    tint: 'bg-status-queued/15 border-status-queued/40 text-ink-muted',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    ),
  },
};

/**
 * Status pill.
 *
 * `watchable` overrides a PROCESSING video that already has a playable
 * rendition: the lowest rung lands within seconds, and showing "Processing"
 * there would hide a working stream.
 */
export function StatusBadge({
  status,
  watchable = false,
}: {
  status: VideoStatus;
  watchable?: boolean;
}) {
  const meta =
    watchable && status === 'PROCESSING'
      ? { ...STATUS_META.COMPLETED, label: 'Ready to watch' }
      : STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.tint}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

// --- Progress --------------------------------------------------------------
export function ProgressBar({
  percent,
  label,
  tone = 'processing',
  className = '',
}: {
  percent: number;
  label: string;
  tone?: 'accent' | 'processing';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 overflow-hidden rounded-full bg-surface-inset ${className}`}
    >
      <div
        className={`h-full transition-[width] ${tone === 'accent' ? 'bg-accent' : 'bg-status-processing'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function RenditionChip({
  name,
  state,
}: {
  name: string;
  state: 'done' | 'active' | 'pending';
}) {
  const tint =
    state === 'done'
      ? 'bg-status-ready/15 border-status-ready/40 text-status-ready'
      : state === 'active'
        ? 'bg-status-processing/15 border-status-processing/45 text-status-processing'
        : 'bg-surface-inset border-surface-border text-ink-muted';
  return (
    <span className={`rounded-md border px-2 py-0.5 font-mono text-xs ${tint}`}>{name}</span>
  );
}

// --- Quota -----------------------------------------------------------------
/** Three distinct states: normal, warning at 80%, blocked at 100%. */
export function quotaState(used: number, quota: number): 'normal' | 'warning' | 'full' {
  if (quota <= 0) return 'normal';
  const ratio = used / quota;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.8) return 'warning';
  return 'normal';
}

export function QuotaMeter({
  used,
  quota,
  compact = false,
}: {
  used: number;
  quota: number;
  compact?: boolean;
}) {
  const state = quotaState(used, quota);
  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  const fill =
    state === 'full' ? 'bg-status-failed' : state === 'warning' ? 'bg-status-processing' : 'bg-accent';
  const text =
    state === 'full' ? 'text-status-failed' : state === 'warning' ? 'text-status-processing' : 'text-ink-muted';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className={text}>
          {state === 'full' ? 'Full — uploads blocked' : state === 'warning' ? `Warning — ${Math.round(percent)}%` : 'Storage'}
        </span>
        <span className="font-mono text-ink-soft">
          {formatBytes(used)} / {formatBytes(quota)}
        </span>
      </div>
      <div className={`${compact ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full bg-ground`}>
        <div className={`h-full ${fill}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// --- Layout helpers --------------------------------------------------------
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-surface-border bg-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  footnote,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  footnote?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-surface-border bg-surface px-10 py-14 text-center">
      <svg viewBox="0 0 24 24" className="h-10 w-10 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M10 9l5 2-5 2z" />
        <path d="M8 21h8" />
      </svg>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-[15px] leading-relaxed text-ink-muted">{body}</p>
      </div>
      {action}
      {footnote && <span className="text-xs text-ink-muted">{footnote}</span>}
    </div>
  );
}

export function Alert({
  tone,
  title,
  children,
  action,
}: {
  tone: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const skin = {
    info: 'border-accent/35 bg-accent/10 text-accent-soft',
    warning: 'border-status-processing/40 bg-status-processing/10 text-status-processing',
    error: 'border-status-failed/42 bg-status-failed/10 text-status-failed',
    success: 'border-status-ready/40 bg-status-ready/10 text-status-ready',
  }[tone];

  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`flex flex-wrap items-start gap-3 rounded-card border p-4 ${skin}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        {title && <span className="text-sm font-semibold">{title}</span>}
        <div className="text-[13px] leading-relaxed text-ink-soft">{children}</div>
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <span className="text-[13px] text-status-failed">{error}</span>
      ) : (
        hint && <span className="text-[13px] text-ink-muted">{hint}</span>
      )}
    </div>
  );
}

export const inputClass =
  'w-full min-h-[44px] rounded-control border border-surface-border bg-surface-inset px-3 text-sm text-ink placeholder:text-ink-muted';
