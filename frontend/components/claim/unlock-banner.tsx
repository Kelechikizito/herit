"use client";

import { ClockIcon, LockIcon, UnlockIcon } from "@/components/ui/icons";
import { IconCircle } from "@/components/ui/icon-circle";
import { type Estate, formatAgo, formatStamp, unlockAt } from "@/lib/estate";
import { useNow } from "@/lib/estate/use-now";

type Banner = {
  icon: React.ReactNode;
  title: string;
  body: string;
  tag: string;
  tone: string;
  bodyTone: string;
};

/**
 * Where the estate stands, from the heir's side. Driven by the pending status and the heir's ENS
 * claim role, which can disagree: a lapsed estate nobody has poked is unlocked, but its roles are
 * still withheld until the unlock transition runs.
 */
export function UnlockBanner({
  estate,
  canClaim,
  now,
}: {
  estate: Estate;
  canClaim: boolean;
  now: number;
}) {
  const tick = useNow(now);
  const banner = bannerFor(estate, canClaim, tick);

  return (
    <div
      className={`mt-6 flex flex-wrap items-center gap-4 rounded-[10px] border-2 border-ink px-5 py-4 shadow-brut ${banner.tone}`}
    >
      <IconCircle size="xl" accent="bg-surface" className="text-ink">
        {banner.icon}
      </IconCircle>
      <div className="min-w-[16rem] flex-1">
        <p className="text-sm font-bold">{banner.title}</p>
        <p className={`mt-0.5 text-xs ${banner.bodyTone}`}>{banner.body}</p>
      </div>
      <span className="tag tag-shadow flex-shrink-0 bg-surface text-ink">{banner.tag}</span>
    </div>
  );
}

function bannerFor(estate: Estate, canClaim: boolean, now: number): Banner {
  const unlocksAt = unlockAt(estate.clock);

  if (estate.status === "unlocked") {
    return {
      icon: <UnlockIcon size={20} />,
      tone: "bg-coral text-white",
      bodyTone: "text-white/85",
      tag: unlocksAt === null ? "unlocked" : `unlocked ${formatAgo(now - unlocksAt)}`,
      ...(canClaim
        ? {
            title: "the estate has unlocked",
            body: "ROLE_HEIR_CLAIM was granted on your subname when the unlock ran. one selfie check of your own releases your share.",
          }
        : {
            title: "grace has lapsed",
            body: "nobody has run the unlock yet, so your claim role still reads as withheld. claiming runs it first, then releases your share.",
          }),
    };
  }

  if (estate.status === "grace") {
    return {
      icon: <ClockIcon size={20} />,
      tone: "bg-yellow",
      bodyTone: "text-muted",
      title: "the grantor missed a check-in",
      body: "the estate is in grace. one selfie check from the grantor seals it again; if none comes, it unlocks and your claim opens.",
      tag: unlocksAt === null ? "in grace" : `unlocks ${formatStamp(unlocksAt)}`,
    };
  }

  return {
    icon: <LockIcon size={20} />,
    tone: "bg-surface",
    bodyTone: "text-muted",
    title: "the estate is sealed",
    body: "the grantor is checking in. your claim role stays withheld until a check-in window and its grace period both lapse.",
    tag: unlocksAt === null ? "clock not started" : `earliest unlock ${formatStamp(unlocksAt)}`,
  };
}
