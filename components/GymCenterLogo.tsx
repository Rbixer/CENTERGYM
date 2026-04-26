const LOGO = "/gymcenter-logo.png";

type Props = {
  className?: string;
};

/**
 * Logo GYM CENTER (`public/gymcenter-logo.png`).
 * Usa `<img>` nativo (no `next/image`) para el LCP: evita el aviso de Next sobre `loading="eager"`.
 */
export function GymCenterLogo({
  className = "h-auto w-auto max-h-[7.5rem] max-w-[min(100%,280px)] object-contain",
}: Props) {
  return (
    <img
      src={LOGO}
      alt="GYM CENTER"
      width={180}
      height={180}
      decoding="sync"
      fetchPriority="high"
      loading="eager"
      className={className}
    />
  );
}
