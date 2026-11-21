/**
 * 인라인 라인 아이콘(20×20, 2px stroke) — 이모지 아이콘 제거용.
 * 아이콘 폰트/외부 패키지 없이 앱 안에서 직접 관리한다.
 */
import type { SVGProps } from 'react';

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** 실시간 — 반원 게이지 바늘 */
export function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 14a7 7 0 0 1 14 0" />
      <path d="M10 14 13 9" />
      <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/** 예측 — 히트맵 그리드 */
export function HeatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/** 안내 — 정보 */
export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 9v4.5" />
      <circle cx="10" cy="6.4" r="0.9" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/** 새로고침 — 회전 화살표 (로딩 중 spin 클래스 대상) */
export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M16 10a6 6 0 1 1-1.8-4.3" />
      <path d="M16 2.8v3.4h-3.4" />
    </IconBase>
  );
}

/** 링크 행 화살표 */
export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m8 4 6 6-6 6" />
    </IconBase>
  );
}
