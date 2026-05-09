import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Fallback variant: gradient (event covers) or neutral (logos/avatars). */
  fallback?: "gradient" | "neutral";
  loading?: "lazy" | "eager";
};

/**
 * Image with graceful fallback when src is missing or fails to load.
 */
export function CoverImage({ src, alt, className, fallback = "gradient", loading = "lazy" }: Props) {
  const [errored, setErrored] = useState(false);
  const showFallback = !src || errored;

  if (showFallback) {
    return (
      <div
        className={cn("h-full w-full", fallback === "neutral" && "bg-muted", className)}
        style={fallback === "gradient" ? { background: "var(--gradient-primary)" } : undefined}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
