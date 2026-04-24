import Image from "next/image";

const LOGO = "/gymcenter-logo.png";

type Props = {
  /** Prioridad de carga (portada / admin). */
  priority?: boolean;
  className?: string;
};

/** Logo GYM CENTER (180×180 en `public/gymcenter-logo.png`). */
export function GymCenterLogo({
  priority = false,
  className = "h-auto w-auto max-h-[7.5rem] max-w-[min(100%,280px)] object-contain",
}: Props) {
  return (
    <Image
      src={LOGO}
      alt="GYM CENTER"
      width={180}
      height={180}
      priority={priority}
      className={className}
    />
  );
}
