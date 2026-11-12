'use client';

import { useEffect, useRef } from 'react';
import styles from './FoilHome.module.css';

type Mounted = { dispose: () => void };
type FoilWindow = Window & { __foilMount?: (root: HTMLElement) => Mounted };

/** The fixed WebGL stage behind the home page. The scene itself lives in /public/foil. */
export default function FoilStage() {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current?.closest('main');
    if (!root) return;
    let mounted: Mounted | null = null;
    let cancelled = false;
    const start = () => {
      const mount = (window as FoilWindow).__foilMount;
      if (!cancelled && !mounted && mount) mounted = mount(root as HTMLElement);
    };
    if ((window as FoilWindow).__foilMount) start();
    else {
      window.addEventListener('foil-ready', start, { once: true });
      if (!document.querySelector('script[data-foil-loader]')) {
        const script = document.createElement('script');
        script.type = 'module';
        script.dataset.foilLoader = '';
        script.textContent = "import{mount}from'/foil/scene.js';window.__foilMount=mount;window.dispatchEvent(new Event('foil-ready'));";
        document.head.appendChild(script);
      }
    }
    return () => { cancelled = true; window.removeEventListener('foil-ready', start); mounted?.dispose(); };
  }, []);
  return <div ref={stage} className={styles.stage} data-foil-stage="" aria-hidden="true"><canvas /></div>;
}
