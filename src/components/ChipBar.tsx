import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/format";
import { Icon } from "./Icon";

export function ChipBar({
  chips,
  value,
  onChange,
  ariaLabel = "Filters",
}: {
  chips: string[];
  value: string;
  onChange: (c: string) => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: true });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  };

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [chips.length]);

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div className="chipbar" aria-label={ariaLabel}>
      {edges.left && (
        <button className="chipbar__nav chipbar__nav--left" onClick={() => scrollBy(-1)} aria-label="Scroll left">
          <Icon name="chevronLeft" size={20} />
        </button>
      )}
      <div className="chipbar__track" ref={ref} onScroll={measure}>
        {chips.map((c) => (
          <button
            key={c}
            className={cx("chip", c === value && "is-active")}
            onClick={() => onChange(c)}
            aria-pressed={c === value}
          >
            {c}
          </button>
        ))}
      </div>
      {edges.right && (
        <button className="chipbar__nav chipbar__nav--right" onClick={() => scrollBy(1)} aria-label="Scroll right">
          <Icon name="chevronRight" size={20} />
        </button>
      )}
    </div>
  );
}
