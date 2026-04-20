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
  "/branding/kol-verdict-mark.png";
