import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";

export default async function DashboardIndex() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  switch (session.role) {
    case "ADMIN":
      redirect("/admin/dashboard");
    case "FINANCE":
      redirect("/finance/dashboard");
    case "INSTRUCTOR":
      redirect("/instructor/dashboard");
    default:
      redirect("/user/dashboard");
  }
}
