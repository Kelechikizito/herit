import { Footer } from "@/components/layout/footer";
import { SiteNav } from "@/components/layout/site-nav";

/** The app shell: the same floating navbar as the landing page, in its signed-in variant. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav variant="app" />
      <main className="flex-1 px-4 pb-16 pt-10 sm:px-6">{children}</main>
      <Footer />
    </>
  );
}
