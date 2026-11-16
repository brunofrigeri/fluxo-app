import { Footer, FinalCta, Header } from "@/components/Chrome";
import { Audience, Features } from "@/components/Features";
import { Hero } from "@/components/Hero";
import { Pricing } from "@/components/Pricing";
import { Faq, Steps, Trial } from "@/components/Steps";
import { signUpUrl } from "@/lib/urls";

export default function Home() {
  return (
    <div className="fx lp" data-theme="light">
      <div className="lpw">
        <Header />
        <main id="top">
          <Hero />
          <Audience />
          <Features />
          <Steps />
          <Pricing signUpUrl={signUpUrl} />
          <Trial />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
