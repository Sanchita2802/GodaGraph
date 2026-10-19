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

  useEffect(() => {
    let isMounted = true;
    fetch('/api/config')
      .then((res) => {
        if (!res.ok) throw new Error('Config fetch failed');
        return res.json();
      })
      .then((data: MapConfig) => {
        if (isMounted) {
          setConfig(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load map config from /api/config, using Leaflet fallback:', err);
        if (isMounted) {
          setGoogleFailed(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // If Google Maps key is configured and hasn't failed, render GoogleLiveMap
  if (config?.mapsKey && !googleFailed) {
    return (
      <GoogleLiveMap
        apiKey={config.mapsKey}
        mapId={config.mapId}
        useRoutes={config.useRoutes}
        onAuthFailure={() => setGoogleFailed(true)}
        {...props}
      />
    );
  }

  // Robust, instant default fallback: LeafletLiveMap (never shows a blank map)
  return <LeafletLiveMap {...props} />;
};
