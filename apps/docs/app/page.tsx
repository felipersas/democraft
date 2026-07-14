import { redirect } from "next/navigation";

/**
 * Root → redirect to the default-locale docs landing page.
 */
export default async function RootPage() {
  return redirect("/en/docs/introduction");
}
