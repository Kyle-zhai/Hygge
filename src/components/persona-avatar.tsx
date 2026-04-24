"use client";

import Image from "next/image";

function isUrl(str: string) {
  return str.startsWith("http://") || str.startsWith("https://");
}

export function PersonaAvatar({
  avatar,
  size = 40,
  className = "",
}: {
  avatar: string;
  size?: number;
  className?: string;
}) {
  const sizeClass = `h-[${size}px] w-[${size}px]`;

  if (isUrl(avatar)) {
    return (
      <div
        className={`shrink-0 overflow-hidden rounded-full bg-[color:var(--bg-tertiary)] ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={avatar}
          alt="Avatar"
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-tertiary)] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {avatar}
    </div>
  );
}
