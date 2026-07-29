import { redirect } from "next/navigation";

/** Экран простой версии переехал — редирект, чтобы старые ссылки не давали 404. */
export default function Page() {
  redirect("/");
}
