import type { Metadata } from "next";
import { Caveat, DM_Sans } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { Providers } from "./providers";
import { config } from "@/lib/wagmi/config";
import "./globals.css";

// DM Sans carries the whole interface; Caveat is used sparingly, only for handwritten callouts.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "herit — inheritance gated by proof of life",
  description:
    "Register heirs as ENS subnames, prove you are alive with a World ID Selfie Check, and hand over enhanced access control automatically if the check-in window lapses.",
  openGraph: {
    title: "herit — inheritance gated by proof of life",
    description:
      "Next-of-kin inheritance on ENSv2, gated by a World ID Selfie Check instead of a timestamp a bot can ping.",
    type: "website",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialState = cookieToInitialState(config, (await headers()).get("cookie"));

  return (
    <html lang="en" className={`${dmSans.variable} ${caveat.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-cream text-ink">
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
