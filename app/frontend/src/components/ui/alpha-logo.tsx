import Image from 'next/image';

interface AlphaLogoProps {
  className?: string;
  priority?: boolean;
}

export function AlphaLogo({ className, priority }: AlphaLogoProps) {
  return (
    <Image
      src="/logo-icon.png"
      alt="AlphaCarnes"
      width={32}
      height={32}
      className={className}
      priority={priority}
    />
  );
}
