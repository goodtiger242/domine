/** 서브페이지 상단 네비게이션 링크 */

export type SiteNavLink = { href: string; label: string };

/**
 * 모든 페이지 상단 네비에서 캘린더·청년회 멤버 링크를 끌 수 있습니다.
 * 페이지·라우트는 그대로 두고 네비만 숨깁니다. 다시 보이게 하려면 true로 바꾸면 됩니다.
 */
export const SITE_NAV_SHOW_CALENDAR = false;
export const SITE_NAV_SHOW_YOUTH = false;

const navCalendar: SiteNavLink[] = SITE_NAV_SHOW_CALENDAR
  ? [{ href: "/calendar", label: "캘린더" }]
  : [];

const navYouth: SiteNavLink[] = SITE_NAV_SHOW_YOUTH
  ? [{ href: "/youth", label: "청년회 멤버" }]
  : [];

/** 메인(/) 상단 네비 */
export const SITE_NAV_HOME: SiteNavLink[] = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
  ...navCalendar,
  ...navYouth,
];

export const SITE_NAV_LITURGICAL: SiteNavLink[] = [
  { href: "/liturgical/edit", label: "전례 편집" },
  ...navCalendar,
  ...navYouth,
];

export const SITE_NAV_CALENDAR: SiteNavLink[] = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
  ...navYouth,
];

export const SITE_NAV_YOUTH: SiteNavLink[] = [
  { href: "/liturgical", label: "전례 안내" },
  { href: "/liturgical/edit", label: "전례 편집" },
  ...navCalendar,
];

export const SITE_NAV_EDIT: SiteNavLink[] = [
  { href: "/liturgical", label: "전례 안내" },
  ...navCalendar,
  ...navYouth,
];
