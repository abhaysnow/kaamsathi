import {
  FileText,
  House,
  IndianRupee,
  Landmark,
  MessageCircle,
  PenLine,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Shown directly in the mobile bottom bar; everything else lives under "More". */
  primaryOnMobile?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/', labelKey: 'nav_home', icon: House, primaryOnMobile: true },
  { href: '/ask', labelKey: 'nav_assistant', icon: MessageCircle, primaryOnMobile: true },
  { href: '/earnings', labelKey: 'nav_earnings', icon: IndianRupee, primaryOnMobile: true },
  { href: '/schemes', labelKey: 'nav_schemes', icon: Landmark },
  { href: '/rights', labelKey: 'nav_rights', icon: ShieldCheck },
  { href: '/documents', labelKey: 'nav_documents', icon: FileText },
  { href: '/complaints', labelKey: 'nav_complaints', icon: PenLine },
  { href: '/settings', labelKey: 'nav_settings', icon: Settings },
];

export const isActive = (href: string, path: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);

export const currentNav = (path: string) => NAV.find((n) => isActive(n.href, path));
