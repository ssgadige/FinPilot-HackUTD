// Test adapter for isolated component rendering, not production Next.js navigation.
export const usePathname = () =>
  ({
    overview: "/overview",
    transactions: "/transactions",
    cash: "/cash-and-bills",
    accounts: "/accounts",
    coach: "/agent-workspace",
  })[location.hash.slice(1)] ?? "/institutions";
export const useRouter = () => ({
  refresh: () => window.dispatchEvent(new Event("test-router-refresh")),
  replace: (href: string) => {
    location.href = href;
  },
  push: (href: string) => {
    location.href = href;
  },
});
