import { z } from 'zod';

export const paginationQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 1 && v <= 100), {
      message: 'limit must be between 1 and 100',
    })
    .optional(),
  cursor: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function parseCursor(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function paginate<T>(items: readonly T[], cursor: number, limit: number) {
  const start = Math.max(0, Math.min(items.length, cursor));
  const end = Math.max(start, Math.min(items.length, start + limit));
  const data = items.slice(start, end);
  const nextCursor = end < items.length ? String(end) : null;
  const hasMore = end < items.length;
  return {
    data,
    pagination: {
      cursor: String(start),
      next_cursor: nextCursor,
      has_more: hasMore,
      limit,
      total: items.length,
    },
  };
}


