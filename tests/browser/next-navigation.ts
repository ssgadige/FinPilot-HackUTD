// Test adapter for isolated component rendering, not production Next.js navigation.
export const usePathname = () =>
  ({
    subscriptions: "/subscriptions",
    goals: "/goals-and-plans",
    debts: "/debt-and-readiness",
    assets: "/assets",
    scenarios: "/scenario-lab",
    coach: "/agent-workspace",
    integrated: "/agent-workspace",
    agents: "/agent-workspace",
    overview: "/overview",
    transactions: "/transactions",
    cash: "/cash-and-bills",
    accounts: "/accounts",
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
