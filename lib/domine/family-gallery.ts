/**
 * 메인 히어로 단체 사진 갤러리.
 * `public/image/` 에 `domine_familiy.jpg`, `domine_familiy1.jpg` … 형태로 두고 아래 순서를 맞춥니다.
 */
export type FamilyGalleryItem = {
  src: string;
  alt: string;
};

export const familyGalleryImages: readonly FamilyGalleryItem[] = [
  { src: "/image/domine_familiy.jpg", alt: "도미네 단체 사진" },
  { src: "/image/domine_familiy1.jpg", alt: "도미네 단체 사진 2" },
  { src: "/image/domine_familiy2.jpg", alt: "도미네 단체 사진 3" },
  { src: "/image/domine_familiy3.jpg", alt: "도미네 단체 사진 4" },
  { src: "/image/domine_familiy4.jpg", alt: "도미네 단체 사진 5" },
  { src: "/image/domine_familiy5.jpg", alt: "도미네 단체 사진 6" },
  { src: "/image/domine_familiy6.jpg", alt: "도미네 단체 사진 7" },
  { src: "/image/domine_familiy7.jpg", alt: "도미네 단체 사진 8" },
  { src: "/image/domine_familiy8.jpg", alt: "도미네 단체 사진 9" },
];
