import React, { useEffect, useState } from 'react';
import { JourneyRoute, TransitNode } from '../../types';
import { LeafletLiveMap } from './LeafletLiveMap';
import { GoogleLiveMap } from './GoogleLiveMap';

export interface LiveMapProps {
  selectedRoute?: JourneyRoute | null;
  highlightedStopId?: string | null;
  onSelectStop?: (stop: TransitNode) => void;
  className?: string;
  showSimulatedBuses?: boolean;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  showSimulatedVehicles?: boolean;
}

interface MapConfig {
  mapsKey: string | null;
  mapId: string;
  useRoutes?: boolean;
}

export const LiveMap: React.FC<LiveMapProps> = (props) => {
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [googleFailed, setGoogleFailed] = useState<boolean>(false);
  const [configSucceeded, setConfigSucceeded] = useState<boolean | null>(null);
  const [tileInfo, setTileInfo] = useState<{ tileProvider: string; tileErrorCount: number }>({
    tileProvider: 'OpenStreetMap Standard',
    tileErrorCount: 0,
  });
  const [debugDismissed, setDebugDismissed] = useState<boolean>(false);

  const isDebugMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debugmap') === '1';

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('/api/config', { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeoutId);
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          throw new Error(`Config fetch failed with status ${res.status}`);
        }
        if (!contentType.includes('application/json')) {
          throw new Error(`Expected application/json response but received: ${contentType}`);
        }
        return res.json();
      })
      .then((data: MapConfig) => {
        if (isMounted) {
          setConfig(data);
          setConfigSucceeded(true);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.warn('Could not load map config from /api/config, checking client env or using Leaflet fallback:', err);
        if (isMounted) {
          setConfigSucceeded(false);
          // Optional build-time fallback from VITE_GOOGLE_MAPS_API_KEY
          const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          if (viteKey) {
            setConfig({
              mapsKey: viteKey,
              mapId: 'DEMO_MAP_ID',
              useRoutes: false,
            });
          } else {
            setGoogleFailed(true);
          }
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const isUsingGoogle = Boolean(config?.mapsKey && !googleFailed);

  return (
    <div className="relative w-full h-full">
      {isUsingGoogle ? (
        <GoogleLiveMap
          apiKey={config!.mapsKey!}
          mapId={config?.mapId}
          useRoutes={config?.useRoutes}
          onAuthFailure={() => setGoogleFailed(true)}
          {...props}
        />
      ) : (
        <LeafletLiveMap
          onDebugInfo={(info) => setTileInfo(info)}
          {...props}
        />
      )}

      {/* Debug Map Overlay (only visible when URL contains ?debugmap=1 and not dismissed) */}
      {isDebugMode && !debugDismissed && (
        <div className="absolute top-4 left-4 z-40 bg-white/95 dark:bg-[#1F1B2B]/95 backdrop-blur-md p-3.5 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl text-xs font-mono text-[#3B2F4A] dark:text-[#F2EEF9] max-w-xs space-y-1.5 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-1">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Map Diagnostics</span>
            <button
              onClick={() => setDebugDismissed(true)}
              className="text-[#7E708E] hover:text-black dark:hover:text-white px-1 text-sm font-bold leading-none cursor-pointer"
              title="Dismiss"
            >
              ×
            </button>
          </div>
          <div>
            <span className="text-[#7E708E] dark:text-[#9E94B3]">Renderer: </span>
            <span className="font-semibold">{isUsingGoogle ? 'Google Maps JS' : 'Leaflet'}</span>
          </div>
          <div>
            <span className="text-[#7E708E] dark:text-[#9E94B3]">/api/config: </span>
            <span className={configSucceeded === true ? 'text-emerald-600 font-semibold' : configSucceeded === false ? 'text-amber-600 font-semibold' : 'text-zinc-500'}>
              {configSucceeded === true ? '200 OK (JSON)' : configSucceeded === false ? 'Failed (Fallback)' : 'Fetching...'}
            </span>
          </div>
          <div>
            <span className="text-[#7E708E] dark:text-[#9E94B3]">Tile Provider: </span>
            <span className="font-semibold">{isUsingGoogle ? 'Google Maps Vector' : tileInfo.tileProvider}</span>
          </div>
          {!isUsingGoogle && (
            <div>
              <span className="text-[#7E708E] dark:text-[#9E94B3]">Tile Errors: </span>
              <span className={tileInfo.tileErrorCount > 0 ? 'text-amber-500 font-bold' : 'text-emerald-600 font-semibold'}>
                {tileInfo.tileErrorCount}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
