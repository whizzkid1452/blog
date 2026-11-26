interface PixelIconProps {
  name: 'gamepad' | 'arrow' | 'star';
  className?: string;
}

const paths = {
  gamepad: 'M3 3h10v2h2v8h-4v-2H5v2H1V5h2V3Zm1 3v1H3v2h1v1h2V9h1V7H6V6H4Zm6 1v2h2V7h-2Z',
  arrow: 'M8 2h2v2h2v2h2v4h-2v2h-2v2H8v-4H1V6h7V2Z',
  star: 'M6 0h4v4h2v2h4v4h-4v2h-2v4H6v-4H4v-2H0V6h4V4h2V0Z',
};

export function PixelIcon({ name, className }: PixelIconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="currentColor"
      fillRule="evenodd"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
