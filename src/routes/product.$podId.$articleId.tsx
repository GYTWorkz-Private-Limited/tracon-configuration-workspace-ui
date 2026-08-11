import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The Product step was replaced by the compact product header rendered on the
 * workspace pages. Any existing Product link lands on Configuration instead.
 */
export const Route = createFileRoute("/product/$podId/$articleId")({
  validateSearch: (s: Record<string, unknown>) => ({
    sel: typeof s.sel === "string" ? s.sel : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/config/$podId/$articleId",
      params,
      search,
    });
  },
  component: () => null,
});
