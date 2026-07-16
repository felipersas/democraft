import Image from "next/image";

type BrandTheme = "dark" | "light";

export function BrandMark({ theme = "dark" }: { theme?: BrandTheme }) {
  return (
    <Image
      alt="Democraft mark"
      className="h-7 w-[25px] object-contain"
      height={150}
      src={`/brand/democraft-mark-${theme}.png`}
      width={135}
    />
  );
}

export function Brand({
  priority = false,
  theme = "dark",
}: {
  priority?: boolean;
  theme?: BrandTheme;
}) {
  return (
    <Image
      alt="Democraft"
      className="h-auto w-full object-contain"
      height={170}
      priority={priority}
      src={`/brand/democraft-lockup-${theme}.png`}
      width={570}
    />
  );
}
