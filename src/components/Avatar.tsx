import { useState } from "react";
import { avatarProxyUrl, colorFor, cx, initials } from "../lib/format";

export function Avatar({
  name,
  size = 36,
  className,
  ring,
  src,
}: {
  name: string;
  size?: number;
  className?: string;
  ring?: boolean;
  src?: string;
}) {
  const [from, to] = colorFor(name);
  const [imgFailed, setImgFailed] = useState(false);
  // Proxied WebP keeps avatars small (~2 kB) and avoids cross-origin blocks.
  const proxied = src ? avatarProxyUrl(src) : undefined;
  const useImg = !!proxied && !imgFailed;
  return (
    <span
      className={cx("avatar", ring && "avatar--ring", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.4)),
        backgroundImage: useImg ? undefined : `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden="true"
    >
      {useImg ? (
        <img
          className="avatar__img"
          src={proxied}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
