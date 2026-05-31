"use client";

import { isCustomBrandLogo, themeColorToHex } from "@/lib/brand";
import type { ThemeColor } from "@/lib/types";

interface GorillaMascotProps {
  themeColor?: ThemeColor;
  logoUrl?: string;
  className?: string;
  size?: "sm" | "md";
}

/** 內嵌 SVG 大猩猩 — 背心 fill 跟 tenant theme_color 變色 */
export function GorillaMascot({
  themeColor = "emerald",
  logoUrl,
  className = "",
  size = "md",
}: GorillaMascotProps) {
  const vestColor = themeColorToHex(themeColor);
  const showLogo = isCustomBrandLogo(logoUrl);
  const dim = size === "sm" ? "w-14 h-14" : "w-[4.5rem] h-[4.5rem]";

  return (
    <div className={`relative shrink-0 ${dim} ${className}`} aria-hidden>
      <svg
        viewBox="0 0 1024 1024"
        className="w-full h-full drop-shadow-sm"
        role="img"
        aria-label="Nutrition Coach 吉祥物"
      >
        {/* 黑色身體 */}
        <path
          fill="#000"
          d="M512 80
             C680 80 780 160 820 260
             C860 200 940 220 980 320
             C1020 420 980 540 920 620
             C960 700 940 820 860 900
             C780 980 640 980 512 980
             C384 980 244 980 164 900
             C84 820 64 700 104 620
             C44 540 4 420 44 320
             C84 220 164 200 204 260
             C244 160 344 80 512 80Z"
        />

        {/* 白色臉部 */}
        <path
          fill="#fff"
          d="M512 210
             C620 210 700 270 720 360
             C740 450 700 530 640 570
             C600 600 560 610 512 610
             C464 610 424 600 384 570
             C324 530 284 450 304 360
             C324 270 404 210 512 210Z"
        />

        {/* 眉毛 */}
        <path
          fill="#000"
          d="M390 340 C420 310 470 310 500 340 C470 360 420 360 390 340Z"
        />
        <path
          fill="#000"
          d="M524 340 C554 310 604 310 634 340 C604 360 554 360 524 340Z"
        />

        {/* 眼睛 */}
        <circle cx="445" cy="395" r="38" fill="#000" />
        <circle cx="579" cy="395" r="38" fill="#000" />
        <circle cx="458" cy="382" r="10" fill="#fff" />
        <circle cx="592" cy="382" r="10" fill="#fff" />

        {/* 鼻孔 */}
        <path
          fill="#000"
          d="M470 455 C485 430 500 430 512 445 C524 430 539 430 554 455 C539 480 524 490 512 490 C500 490 485 480 470 455Z"
        />

        {/* 嘴巴 */}
        <path
          fill="#000"
          d="M360 520 C400 580 440 600 512 600 C584 600 624 580 664 520 C640 640 580 680 512 680 C444 680 384 640 360 520Z"
        />
        <path
          fill="#fff"
          d="M400 560 C440 590 476 600 512 600 C548 600 584 590 624 560 C600 610 560 630 512 630 C464 630 424 610 400 560Z"
        />

        {/* 耳朵 */}
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="12"
          strokeLinecap="round"
          d="M250 320 C220 280 200 320 220 380"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="12"
          strokeLinecap="round"
          d="M774 320 C804 280 824 320 804 380"
        />

        {/* 主題色背心 */}
        <path
          fill={vestColor}
          d="M350 640
             C380 610 440 590 512 590
             C584 590 644 610 674 640
             L690 760
             C660 820 590 860 512 860
             C434 860 364 820 334 760
             Z"
        />

        {/* 自訂 tenant logo（非預設 logo.png） */}
        {showLogo && logoUrl ? (
          <>
            <defs>
              <clipPath id="vest-clip">
                <path d="M350 640 C380 610 440 590 512 590 C584 590 644 610 674 640 L690 760 C660 820 590 860 512 860 C434 860 364 820 334 760 Z" />
              </clipPath>
            </defs>
            <image
              href={logoUrl}
              x="360"
              y="620"
              width="304"
              height="220"
              preserveAspectRatio="xMidYMid meet"
              clipPath="url(#vest-clip)"
            />
          </>
        ) : null}

        {/* 肌肉與肩線 */}
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          d="M120 520 C200 460 280 430 350 450"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          d="M904 520 C824 460 744 430 674 450"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="8"
          strokeLinecap="round"
          d="M390 700 C440 740 472 760 512 760 C552 760 584 740 634 700"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="8"
          strokeLinecap="round"
          d="M430 760 C470 790 490 800 512 800 C534 800 554 790 594 760"
        />

        {/* 背心肩帶 */}
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          d="M350 640 C300 580 240 540 180 500"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          d="M674 640 C724 580 784 540 844 500"
        />
        <path
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          d="M350 640 C400 610 460 590 512 590 C564 590 624 610 674 640"
        />
      </svg>
    </div>
  );
}
