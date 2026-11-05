import Image from 'next/image';
import { Mail, MapPin, ShieldAlert } from 'lucide-react';

export function AboutSection() {
  return (
    <div className="mt-10 sm:mt-12 lg:mt-14">
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-8 xl:gap-10">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-strong/50" aria-hidden />
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.20em] text-muted-foreground">
              About Project GAKIT
            </span>
          </div>
          <h2 className="mt-4 max-w-[20ch] font-heading text-[30px] font-extrabold leading-[1.02] tracking-[-0.025em] text-primary sm:text-[36px] lg:text-[40px]">
            Geohazard assessment and community flood reporting for safer decisions.
          </h2>
          <p className="mt-6 max-w-[60ch] text-[15px] font-medium leading-7 text-secondary sm:text-[16px] sm:leading-8">
            GAKIT unites scientific risk modeling, meteorological feeds, and citizen science in Iligan City. Evaluate site-level exposure to flood, landslide, and storm surge hazards, or report on-the-ground flooding to keep communities and responders informed.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="rounded-2xl border border-default bg-panel p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-secondary">
                  <ShieldAlert className="h-[22px] w-[22px]" />
                </div>
                <h3 className="font-heading text-[15px] font-bold tracking-tight text-primary sm:text-[16px]">Geohazard assessment</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-6 text-secondary">
                Tap or search any location to evaluate site-level geohazard risks, terrain elevation, and real-time rainfall.
              </p>
            </div>
            <div className="rounded-2xl border border-default bg-panel p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-secondary">
                  <MapPin className="h-[22px] w-[22px]" />
                </div>
                <h3 className="font-heading text-[15px] font-bold tracking-tight text-primary sm:text-[16px]">Community reporting</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-6 text-secondary">
                Pin flooded areas and share observed water levels in seconds. Simple, anonymous, and community-driven.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5 lg:pt-10">
          <div className="rounded-2xl border border-default bg-panel p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <a
                href="https://www.msuiit.edu.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-page ring-1 ring-default/70 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:h-14 sm:w-14"
                aria-label="Visit MSU-IIT official website"
              >
                <Image
                  src="/images/iit-logo.png"
                  alt="MSU-IIT logo"
                  width={56}
                  height={56}
                  className="h-full w-full object-contain p-1"
                />
              </a>
              <div className="min-w-0 pt-0.5">
                <div className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  A project of
                </div>
                <h3 className="mt-1 font-heading text-[16px] font-bold leading-tight tracking-tight text-primary sm:text-[17px]">
                  <a
                    href="https://www.msuiit.edu.ph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-primary"
                  >
                    Mindanao State University - Iligan Institute of Technology
                  </a>
                </h3>
              </div>
            </div>
            <p className="mt-5 text-[13.5px] leading-6 text-secondary">
              An applied geohazard research and community flood risk information system built at MSU-IIT to bridge science and local preparedness.
            </p>
            <div className="mt-5 h-px bg-muted" aria-hidden />
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-page px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-default/70">Research</span>
              <span className="rounded-full bg-page px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-default/70">Community</span>
              <span className="rounded-full bg-page px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-default/70">Open Data</span>
            </div>
          </div>

          <div className="rounded-2xl border border-default bg-panel p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-secondary">
                <Mail className="h-[18px] w-[18px]" />
              </div>
              <h3 className="font-heading text-[16px] font-bold tracking-tight text-primary">Contact and collaborate</h3>
            </div>
            <p className="mt-3 text-[13.5px] leading-6 text-secondary">
              Research, data sharing and deployment inquiries.
            </p>
            <a
              href="mailto:support@gakit.ph?subject=Project%20GAKIT%20Inquiry"
              className="mt-4 inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-accent px-5 font-heading text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              <Mail className="h-4 w-4 opacity-70" />
              support@gakit.ph
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
