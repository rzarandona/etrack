function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

const SIZE_PX: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 32,
  md: 36,
  lg: 40,
};

const FONT_SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'text-xs',
  md: 'text-xs',
  lg: 'text-sm',
};

type AvatarProps = {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Show the soft inner ring used in tables. */
  ring?: boolean;
};

/**
 * Circular avatar that renders the photo when present, falling back to a
 * gradient circle with the person's initials. The image and initials paths
 * are rendered separately so the photo doesn't have to cope with a flex
 * parent (which can subtly squish images on Safari/older Chrome).
 */
export function Avatar({ name, url, size = 'lg', ring = true }: AvatarProps) {
  const px = SIZE_PX[size];
  const fontClass = FONT_SIZE[size];
  const ringClass = ring ? 'avatar-ring' : '';

  if (url) {
    return (
      <div
        className={`shrink-0 rounded-full overflow-hidden ${ringClass}`}
        style={{ width: px, height: px }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white font-bold avatar-bg-orange ${fontClass} ${ringClass}`}
      style={{ width: px, height: px }}>
      {initialsOf(name)}
    </div>
  );
}
