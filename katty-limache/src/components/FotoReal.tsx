import { useState } from "react";

interface FotoRealProps {
  src: string;
  label: string;
  alt?: string;
  className?: string;
}

export default function FotoReal({ src, label, alt, className = "" }: FotoRealProps) {
  const [failed, setFailed] = useState(false);
  const path = `/fotos/${src}`;

  if (failed) {
    return (
      <div
        data-label={label}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-charcoal/30 bg-charcoal/5 text-center p-4 ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-8 h-8 text-charcoal/40 shrink-0"
        >
          <path d="M3 7a2 2 0 0 1 2-2h2.5l1-1.5h7l1 1.5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        <p className="text-xs font-body text-charcoal/70 leading-snug">
          Foto pendiente: {label}
        </p>
      </div>
    );
  }

  return (
    <img
      src={path}
      alt={alt ?? label}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
