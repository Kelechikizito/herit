import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { Providers } from "@/app/providers";
import { Footer } from "@/components/layout/footer";
import { SiteNav } from "@/components/layout/site-nav";
import { config } from "@/lib/wagmi/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const initialState = cookieToInitialState(config, (await headers()).get("cookie"));

  return (
    <Providers initialState={initialState}>
      <SiteNav variant="app" />
      <main className="flex-1 px-4 pb-16 pt-10 sm:px-6">{children}</main>
      <Footer />
    </Providers>
  );
}
