import { z } from "zod";

export const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(10),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  order: z.enum(["asc", "desc"]).default("desc")
});

export type ListQuery = z.infer<typeof querySchema>;

export function pagination(query: ListQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
