import Image from 'next/image';

interface AlphaLogoProps {
  className?: string;
}

export function AlphaLogo({ className }: AlphaLogoProps) {
  return (
    <Image
      src="/logo-icon.png"
      alt="AlphaCarnes"
      width={32}
      height={32}
      className={className}
    />
  );
}
