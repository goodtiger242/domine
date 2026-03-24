<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 배포 스탬프·푸시 (필수)

코드 작업을 마치면 사용자가 따로 말하지 않아도 `lib/deploy-stamp.ts`의 `DEPLOYMENT_INDEX`를 **+1** 하고, **커밋·푸시**하며, 응답에 **`배포 인덱스: N → M`** 을 적는다. 상세는 `.cursor/rules/deploy-push.mdc` 를 따른다.
