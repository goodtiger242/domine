/** 서브페이지 상단 네비게이션 링크 */

export type SiteNavLink = { href: string; label: string };

export const SITE_NAV_LITURGICAL: SiteNavLink[] = [
  { href: "/liturgical/edit", label: "전례 편집" },
  { href: "/calendar", label: "캘린더" },
  { href: "/youth", label: "청년회 멤버" },
];

export const SITE_NAV_CALENDAR: SiteNavLink[] = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
  { href: "/youth", label: "청년회 멤버" },
];

export const SITE_NAV_YOUTH: SiteNavLink[] = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
  { href: "/calendar", label: "캘린더" },
];

export const SITE_NAV_EDIT: SiteNavLink[] = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/calendar", label: "캘린더" },
  { href: "/youth", label: "청년회 멤버" },
];
