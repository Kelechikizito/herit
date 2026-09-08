import type { ComponentType } from "react";
import type { IconProps } from "./icons";

/**
 * The heading every card opens with: a coloured icon box, a title, and one line of explanation.
 *
 * `lg` is the setup wizard's variant — a bigger title over a paragraph rather than a caption.
 */
export function CardHeading({
  icon: Icon,
  accent,
  title,
  body,
  size = "md",
}: {
  icon: ComponentType<IconProps>;
  /** Background utility for the icon box, usually a palette swatch. */
  accent: string;
  title: string;
  body: string;
  size?: "md" | "lg";
}) {
  const large = size === "lg";

  return (
    <div className={`flex ${large ? "items-start gap-4" : "items-center gap-3"}`}>
      <span className={`icon-box ${accent}`}>
        <Icon size={22} />
      </span>
      <div>
        <h2 className={large ? "text-2xl" : "text-xl"}>{title}</h2>
        <p
          className={
            large ? "mt-2 max-w-xl text-sm leading-relaxed text-muted" : "text-xs text-muted"
          }
        >
          {body}
        </p>
      </div>
    </div>
  );
}
