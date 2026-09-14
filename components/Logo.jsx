import Image from 'next/image';

export default function Logo({ size = 32, className = '' }) {
  return (
    <Image
      src="/logo-cf.png"
      alt="Chris Fitness"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
      priority
    />
  );
}
