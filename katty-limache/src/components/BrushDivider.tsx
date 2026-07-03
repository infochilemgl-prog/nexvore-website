interface BrushDividerProps {
  fillClassName?: string;
}

export default function BrushDivider({ fillClassName = "fill-cream" }: BrushDividerProps) {
  return (
    <svg
      viewBox="0 0 1440 110"
      preserveAspectRatio="none"
      className="absolute -bottom-px left-0 w-full h-[70px] sm:h-[100px] z-0"
      aria-hidden="true"
    >
      <path
        className={fillClassName}
        d="M0,38 C40,55 75,18 120,32 C150,42 180,10 215,22 C255,36 290,8 330,20
           C365,30 400,58 440,44 C480,30 510,12 555,26 C595,38 630,15 670,24
           C715,34 745,60 790,48 C830,38 860,14 905,28 C945,40 980,16 1020,26
           C1060,36 1090,58 1135,46 C1175,36 1205,12 1250,24 C1290,34 1320,55 1360,42
           C1390,32 1410,20 1440,28 L1440,110 L0,110 Z"
      />
    </svg>
  );
}
