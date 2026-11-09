import { redirect } from "next/navigation";

/** 게임은 메인 화면(전례 안내 위)으로 옮겼다. 옛 주소는 메인으로 보낸다. */
export default function GamesPage() {
  redirect("/#home-pet");
}
