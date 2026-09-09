import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Short, copy-safe display of a long id. Full value stays available via a copy button. */
export function shortId(id: string, head = 8): string {
  if (!id) return '';
  return id.length <= head + 1 ? id : `${id.slice(0, head)}…`;
}

export function formatUsd(value: number | string | null | undefined, digits = 4): string {
  const n = Number(value ?? 0);
  return `$${n.toFixed(digits)}`;
}

export function formatInt(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString();
}
