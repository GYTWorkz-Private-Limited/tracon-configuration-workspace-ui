import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/quotations")({
  head: () => ({
    meta: [
      { title: "Quotations · Tracon" },
      { name: "description", content: "Buyer-facing quotations with AI risk & requote intelligence." },
    ],
  }),
  component: () => <Outlet />,
});
