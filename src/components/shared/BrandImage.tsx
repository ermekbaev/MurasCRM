import Image from "next/image";

export default function BrandImage({ src, alt, width, height, className, ...rest }: React.ComponentProps<typeof Image>) {
  // Без своего логотипа ничего не рисуем: остаётся название текстом (Адилет 23.11: значок-принтер «выглядит нейросетевым»)
  if (!src) return null;
  return <Image src={src} alt={alt} width={width} height={height} className={className} {...rest} />;
}
