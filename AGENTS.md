<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 배포 스탬프·푸시 (필수)

코드 작업을 마치면 사용자가 따로 말하지 않아도 `lib/deploy-stamp.ts`의 `DEPLOYMENT_INDEX`를 **+1** 하고, **커밋·푸시**하며, 응답에 **`배포 인덱스: N → M`** 을 적는다. 상세는 `.cursor/rules/deploy-push.mdc` 를 따른다.

## 모바일·브라우저

모바일·주요 브라우저에서 깨짐 없이 읽히게 하는 보수적 기준은 `.cursor/rules/mobile-browser-baseline.mdc` 를 따른다.

## 이미지 규칙 (기본 절차)

사이트에 새 이미지를 넣을 때는 항상 `scripts/optimize_images.py`로 먼저 줄이고 WebP로 바꾼다(투명 배경 유지).
`--kind character`(640px) / `item`(256px) / `background`(1200px). 원본 PNG·JPG는 `public/`에 두지 않는다.
SVG 안의 `<image>` 처럼 `next/image`를 못 쓰는 곳은 이 변환 결과를 직접 참조하고, 처음 화면에 필요 없는 이미지는 필요할 때 불러온다.
