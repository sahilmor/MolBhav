import { redirect } from "next/navigation";

// The admin login folded into the shared /login page; old links still work.
export default function AdminLoginRedirect() {
  redirect("/login?next=%2Fadmin");
}
