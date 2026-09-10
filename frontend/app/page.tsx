import { CallToAction } from "@/components/landing/call-to-action";
import { ClockSection } from "@/components/landing/clock-section";
import { ContractsSection } from "@/components/landing/contracts-section";
import { Hero } from "@/components/landing/hero";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { TracksSection } from "@/components/landing/tracks-section";
import { Footer } from "@/components/layout/footer";
import { SiteNav } from "@/components/layout/site-nav";

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <ClockSection />
        <TracksSection />
        <ContractsSection />
        <CallToAction />
      </main>
      <Footer />
    </>
  );
}
