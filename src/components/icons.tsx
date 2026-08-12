import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconFrame>
  )
}

export function CrossIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </IconFrame>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 8v5m0 3.5v.01" />
      <path d="M10.3 4.9 3.1 17.4A1.1 1.1 0 0 0 4 19h16a1.1 1.1 0 0 0 .9-1.6L13.7 4.9a1.95 1.95 0 0 0-3.4 0Z" />
    </IconFrame>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7 12h10" />
    </IconFrame>
  )
}

export function ArrowIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </IconFrame>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3v12m-4-4 4 4 4-4M5 20h14" />
    </IconFrame>
  )
}

export function RunIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m9 7 8 5-8 5V7Z" />
    </IconFrame>
  )
}
