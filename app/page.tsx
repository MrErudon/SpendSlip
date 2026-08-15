import { redirect } from "next/navigation";

// The auth middleware handles the real routing decision (session vs. no
// session). This is just a safety net for the rare case a request reaches
// the page without passing through middleware.
export default function RootPage() {
  redirect("/login");
}
