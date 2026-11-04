import type { SVGProps } from 'react';

const base = (d: string) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        width={18}
        height={18}
        {...props}
      >
        <path d={d} />
      </svg>
    );
  };

export const IconMap = base('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14');
export const IconAlert = base('M12 3 2 21h20L12 3Zm0 6v5m0 3v.5');
export const IconRoute = base(
  'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
);
export const IconCalendar = base('M4 6h16v14H4zM4 10h16M8 3v4m8-4v4');
export const IconHistory = base('M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 3');
export const IconCrowd = base('M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a2.5 2.5 0 1 0 0-5M3 20c0-3 3-5 6-5s6 2 6 5m2-5c2 0 4 1.5 4 4');
export const IconLayers = base('m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5');
export const IconSettings = base(
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
);
export const IconLogout = base('M15 4h4v16h-4M10 8l-4 4 4 4m-4-4h11');
export const IconUsers = base(
  'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m7-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
);
export const IconAudit = base(
  'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4',
);
export const IconReport = base('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6m-6 4h4');
export const IconSun = base(
  'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
);
export const IconMoon = base('M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z');
export const IconServer = base(
  'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm0 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4Zm4-8h.01M8 17h.01',
);
export const IconKey = base('M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-3 3v11m0-4h3m-3-3h2');
export const IconDashboard = base('M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z');
export const IconSidebar = base('M4 4h16v16H4zM9 4v16');
export const IconFullscreen = base('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
export const IconFullscreenExit = base('M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5');
export const IconCrosshair = base('M12 3v4m0 10v4M3 12h4m10 0h4M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z');
export const IconOctagon = base('M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3L8.3 3ZM12 8v5m0 3v.5');
export const IconInfo = base('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9v.5');
export const IconCheck = base('m5 12 5 5 9-10');
export const IconClose = base('M6 6l12 12M18 6 6 18');
export const IconBattery = base('M3 8h15v8H3zM21 11v2');
export const IconPlay = base('M7 5v14l11-7L7 5Z');
export const IconGlobe = base(
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z',
);
export const IconPin = base(
  'M12 21s-6.5-5.6-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Zm0-8.7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
);
export const IconRobot = base(
  'M12 4v3M7 7h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Zm2.5 5v1.5m5-1.5v1.5M9.5 16h5',
);
export const IconTrash = base('M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3');
export const IconUpload = base('M12 15V4m0 0L8 8m4-4 4 4M5 15v4h14v-4');
export const IconPlus = base('M12 5v14M5 12h14');
/** Substation: a transmission tower (overview), a thermometer (thermal point), a sound wave (partial discharge), a flag (finding). */
export const IconTower = base('M12 2 7 22m5-20 5 20M8.5 15h7M9.6 10h4.8M5 6h14M7.5 22h9');
export const IconThermo = base('M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0ZM12 9v8');
export const IconWave = base('M3 12h2l2-6 3 12 3-9 2 5 2-2h4');
export const IconFlag = base('M5 21V4m0 0h11l-2 4 2 4H5');
export const IconBolt = base('M13 2 4 14h7l-1 8 9-12h-7l1-8Z');
