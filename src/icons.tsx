import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "stroke" | "fill"> & {
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
};

const ic =
  (path: ReactNode, viewBox = "0 0 24 24") =>
  ({ size = 14, stroke = "currentColor", strokeWidth = 1.6, fill = "none", ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {path}
    </svg>
  );

export const Icons = {
  Drag: ic(
    <>
      <circle cx="9" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </>,
  ),
  Plus: ic(<path d="M12 5v14M5 12h14" />),
  Trash: ic(
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />,
  ),
  Up: ic(<path d="M6 14l6-6 6 6" />),
  Down: ic(<path d="M6 10l6 6 6-6" />),
  Copy: ic(
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>,
  ),
  Print: ic(<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />),
  Down2: ic(<path d="M12 4v12M6 12l6 6 6-6M4 22h16" />),
  Chevron: ic(<path d="M6 9l6 6 6-6" />),
  Doc: ic(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>,
  ),
  Undo: ic(
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
  Redo: ic(
    <>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </>
  ),
};
