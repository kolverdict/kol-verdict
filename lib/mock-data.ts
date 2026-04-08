export type NavKey = "home" | "leaderboard" | "add" | "profile";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  icon: string;
  desktopIcon?: string;
};

export const navItems: NavItem[] = [
  { key: "home", href: "/", label: "Home", icon: "explore", desktopIcon: "home" },
  {
    key: "leaderboard",
    href: "/leaderboard",
    label: "Leaderboard",
    icon: "leaderboard",
    desktopIcon: "equalizer",
  },
  { key: "add", href: "/add", label: "Add", icon: "add_circle", desktopIcon: "add_box" },
  {
    key: "profile",
    href: "/profile",
    label: "Profile",
    icon: "account_circle",
    desktopIcon: "account_circle",
  },
];

export const brandAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBaciet9Hh2buUkZX5len-KYvdOBbU0CFSRW3bcyER50bwwbZ0W3sNq3HWZpeex9f-i1Y3ZtrkXSM_9x-nJ3yJQ61IYWQLp7Uwp_isxEfQva2hCZArvG9iaEPPmyIW1gMruSPrXrVpXdDYixOw5JLgPgzGO5r51uVlfJqcWZvLhH1lDG8ORgQsLsZHTCx7R0o5-YWD41bb5AkKwxhYnzHlqmcmV5kSjnwM81PvbsmD_vD_ybNTpvRqfCXDLYWqh9CIY6wg0JVfueEo";
