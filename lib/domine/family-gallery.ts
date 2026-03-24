/**
 * 메인 히어로 단체 사진 갤러리.
 * `public/image/` 에 파일을 넣고 아래 배열에 항목을 추가하면 캐러셀에 포함됩니다.
 */
export type FamilyGalleryItem = {
  src: string;
  alt: string;
};

export const familyGalleryImages: readonly FamilyGalleryItem[] = [
  {
    src: "/image/domine_familiy.jpg",
    alt: "도미네 단체 사진",
  },
];
