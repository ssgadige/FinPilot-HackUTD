// Test adapter for isolated component rendering, not production Next.js navigation.
export const usePathname = () => "/institutions";
export const useRouter = () => ({
  refresh: () => window.dispatchEvent(new Event("test-router-refresh")),
  replace: (href: string) => {
    location.href = href;
  },
  push: (href: string) => {
    location.href = href;
  },
});
