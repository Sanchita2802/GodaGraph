import React, { useEffect, useRef, useState } from 'react';
import { BUS_ROUTES } from '../../data/busRoutes';
import { SHARED_AUTO_CORRIDORS } from '../../data/sharedAutoCorridors';
import { NASHIK_NODES } from '../../data/nashikNodes';
import { routingEngine } from '../../services/routing';
import { useIsDark } from '../../hooks/useIsDark';
import { JourneyRoute, TransitNode } from '../../types';
import { ViewportGridIndex } from '../../dsa/ViewportGridIndex';
import osmStopsData from '../../data/osmStops.generated.json';

export interface GoogleLiveMapProps {
  apiKey: string;
  mapId?: string;
  useRoutes?: boolean;
  selectedRoute?: JourneyRoute | null;
  highlightedStopId?: string | null;
  onSelectStop?: (stop: TransitNode) => void;
  className?: string;
  showSimulatedBuses?: boolean;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  showSimulatedVehicles?: boolean;
  onAuthFailure?: () => void;
}

let googleScriptLoadingPromise: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string, onAuthFailure?: () => void): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window undefined'));
  if ((window as any).google?.maps) return Promise.resolve();
  if (googleScriptLoadingPromise) return googleScriptLoadingPromise;

  googleScriptLoadingPromise = new Promise((resolve, reject) => {
    let hasSettled = false;

    const handleFailure = (err: any) => {
      if (hasSettled) return;
      hasSettled = true;
      googleScriptLoadingPromise = null;
      if (onAuthFailure) onAuthFailure();
      reject(err);
    };

    (window as any).gm_authFailure = () => {
      console.warn('Google Maps authentication failure detected (gm_authFailure)');
      handleFailure(new Error('Google Maps authentication failed'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?loading=async&libraries=marker,geometry&v=weekly&key=${apiKey}`;
    script.async = true;
    script.onload = () => {
      if (hasSettled) return;
      hasSettled = true;
      resolve();
    };
    script.onerror = (err) => {
      handleFailure(err);
    };
    document.head.appendChild(script);
  });

  return googleScriptLoadingPromise;
}

// 4 Generic SVG vehicle icons (no brand logos)
const VEHICLE_SVGS = {
  bus: (color: string) => `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="15" rx="3" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
      <rect x="5" y="7" width="14" height="6" rx="1" fill="#FFFFFF" opacity="0.9"/>
      <circle cx="7" cy="18" r="2" fill="#1F2937" stroke="#FFFFFF" stroke-width="1"/>
      <circle cx="17" cy="18" r="2" fill="#1F2937" stroke="#FFFFFF" stroke-width="1"/>
    </svg>
  `,
  shared_auto: `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 14L6 6H18L20 14V17H4V14Z" fill="#F59E0B" stroke="#FFFFFF" stroke-width="1.5"/>
      <rect x="7" y="8" width="10" height="4" rx="0.5" fill="#FFFFFF" opacity="0.9"/>
      <circle cx="12" cy="18" r="2.2" fill="#1F2937" stroke="#FFFFFF" stroke-width="1"/>
      <circle cx="6" cy="18" r="1.8" fill="#1F2937"/>
      <circle cx="18" cy="18" r="1.8" fill="#1F2937"/>
    </svg>
  `,
  app_auto: `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 14L6 6H18L20 14V17H4V14Z" fill="#EA580C" stroke="#FFFFFF" stroke-width="1.5"/>
      <rect x="7" y="8" width="10" height="4" rx="0.5" fill="#FFFFFF" opacity="0.9"/>
      <rect x="8" y="4" width="8" height="3" rx="1.5" fill="#000000"/>
      <text x="12" y="6.2" fill="#FFFFFF" font-size="2.2" font-family="sans-serif" font-weight="900" text-anchor="middle">APP</text>
      <circle cx="12" cy="18" r="2.2" fill="#1F2937" stroke="#FFFFFF" stroke-width="1"/>
      <circle cx="6" cy="18" r="1.8" fill="#1F2937"/>
      <circle cx="18" cy="18" r="1.8" fill="#1F2937"/>
    </svg>
  `,
  cab: `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 14L7 8H17L19 14V17H5V14Z" fill="#8B5CF6" stroke="#FFFFFF" stroke-width="1.5"/>
      <rect x="9" y="5" width="6" height="2.5" rx="0.5" fill="#FBBF24" stroke="#FFFFFF" stroke-width="0.8"/>
      <rect x="7.5" y="9" width="9" height="3.5" rx="0.5" fill="#FFFFFF" opacity="0.9"/>
      <circle cx="7.5" cy="17.5" r="2" fill="#1F2937" stroke="#FFFFFF" stroke-width="1"/>
      <circle cx="16.5" cy="17.5" r="2" fill="#1F2937" stroke="#FFFFFF" stroke-width="1"/>
    </svg>
  `,
};

function calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

interface SimulatedVehicle {
  id: string;
  type: 'bus' | 'shared_auto' | 'app_auto' | 'cab';
  label: string;
  color: string;
  currentLat: number;
  currentLng: number;
  heading: number;
  progress: number;
  stops: { lat: number; lng: number }[];
  speed: number;
}

export const GoogleLiveMap: React.FC<GoogleLiveMapProps> = ({
  apiKey,
  mapId = 'DEMO_MAP_ID',
  useRoutes = false,
  selectedRoute,
  highlightedStopId,
  onSelectStop,
  className = '',
  showSimulatedBuses = true,
  userLocation,
  showSimulatedVehicles = true,
  onAuthFailure,
}) => {
  const isDark = useIsDark();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const gridIndexRef = useRef<ViewportGridIndex>(new ViewportGridIndex(0.015));

  const polylinesRef = useRef<any[]>([]);
  const stopMarkersRef = useRef<any[]>([]);
  const vehicleMarkersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const userCircleRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  const [simulatedVehicles, setSimulatedVehicles] = useState<SimulatedVehicle[]>([]);

  // Initialize Spatial Grid
  useEffect(() => {
    const grid = gridIndexRef.current;
    grid.clear();
    grid.insertMany(NASHIK_NODES);

    const extNodes = (osmStopsData?.nodes || []) as TransitNode[];
    if (extNodes.length > 0) {
      grid.insertMany(extNodes);
    }

    const unsub = routingEngine.onExtendedReady(() => {
      const allExt = routingEngine.extGraph.getAllNodes();
      grid.clear();
      grid.insertMany(allExt);
      if (mapInstanceRef.current) {
        updateVisibleStops();
      }
    });

    return () => unsub();
  }, []);

  // Initialize Google Maps instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Listen for runtime gm_authFailure in case Google fires it after script load
    const prevGmAuth = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps authentication failed at runtime, falling back to Leaflet');
      googleScriptLoadingPromise = null;
      if (onAuthFailure) onAuthFailure();
      if (prevGmAuth && prevGmAuth !== (window as any).gm_authFailure) {
        try { prevGmAuth(); } catch {}
      }
    };

    loadGoogleMaps(apiKey, onAuthFailure)
      .then(() => {
        if (!mapContainerRef.current) return;

        const googleMaps = (window as any).google.maps;
        const colorScheme = isDark
          ? googleMaps.ColorScheme?.DARK || 'DARK'
          : googleMaps.ColorScheme?.LIGHT || 'LIGHT';

        const map = new googleMaps.Map(mapContainerRef.current, {
          center: { lat: 19.9975, lng: 73.7898 },
          zoom: 13,
          mapId: mapId || 'DEMO_MAP_ID',
          colorScheme,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new googleMaps.InfoWindow();

        let debounceTimer: any = null;
        map.addListener('idle', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            updateVisibleStops();
          }, 150);
        });

        updateVisibleStops();
        initVehicles();
      })
      .catch((err) => {
        console.error('Failed to load Google Maps, falling back to Leaflet:', err);
        googleScriptLoadingPromise = null;
        if (onAuthFailure) onAuthFailure();
      });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [apiKey]);

  // Update theme dynamically without recreating map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const googleMaps = (window as any).google?.maps;
    if (!googleMaps) return;

    const nextScheme = isDark
      ? googleMaps.ColorScheme?.DARK || 'DARK'
      : googleMaps.ColorScheme?.LIGHT || 'LIGHT';

    if (mapInstanceRef.current.setOptions) {
      mapInstanceRef.current.setOptions({ colorScheme: nextScheme });
    }
  }, [isDark]);

  // Update Visible Stops via ViewportGridIndex
  const updateVisibleStops = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const googleMaps = (window as any).google?.maps;
    if (!googleMaps) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom() || 13;
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const visibleNodes = gridIndexRef.current.queryBounds(
      {
        south: sw.lat(),
        west: sw.lng(),
        north: ne.lat(),
        east: ne.lng(),
      },
      zoom,
      400
    );

    // Clear old markers
    stopMarkersRef.current.forEach((m) => {
      if (m.map) m.map = null;
      if (m.setMap) m.setMap(null);
    });
    stopMarkersRef.current = [];

    visibleNodes.forEach((node) => {
      const isHub = node.type === 'junction' || node.type === 'railway' || node.tier === 'A';
      const markerSize = isHub ? 20 : 14;
      const markerColor =
        node.type === 'railway'
          ? '#8B5CF6'
          : node.type === 'landmark'
          ? '#F59E0B'
          : node.type === 'junction'
          ? '#E0554B'
          : '#10B981';

      const pinEl = document.createElement('div');
      pinEl.style.width = `${markerSize}px`;
      pinEl.style.height = `${markerSize}px`;
      pinEl.style.backgroundColor = markerColor;
      pinEl.style.borderRadius = '50%';
      pinEl.style.border = '2px solid #FFFFFF';
      pinEl.style.boxShadow = '0 3px 8px rgba(0,0,0,0.3)';
      pinEl.style.cursor = 'pointer';

      let marker: any = null;

      if (googleMaps.marker?.AdvancedMarkerElement) {
        marker = new googleMaps.marker.AdvancedMarkerElement({
          map,
          position: { lat: node.lat, lng: node.lng },
          content: pinEl,
          title: node.name,
        });
      } else {
        marker = new googleMaps.Marker({
          map,
          position: { lat: node.lat, lng: node.lng },
          title: node.name,
        });
      }

      const routesList = node.serves && node.serves.length > 0 ? node.serves.join(', ') : 'Feeder / Auto';
      const infoContent = `
        <div style="font-family: 'Onest', sans-serif; padding: 6px; min-width: 190px; color: #1F2937;">
          <h4 style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">${node.name}</h4>
          <p style="font-size: 11px; color: #E0554B; font-weight: 600; margin-bottom: 6px;">${node.nameMr || ''}</p>
          <div style="font-size: 11px; color: #4B5563; margin-bottom: 4px;">
            <strong>Serves Routes:</strong> ${routesList}
          </div>
          <div style="background: #F3F4F6; padding: 6px; border-radius: 8px; margin-top: 6px;">
            <div style="font-size: 10px; font-weight: 700; color: #6B21A8; text-transform: uppercase;">Next Departures:</div>
            <div style="font-size: 11px; color: #374151; margin-top: 2px;">
              • Route 101: <strong>in 4 min</strong><br/>
              • Route 204: <strong>in 11 min</strong><br/>
              • Seat Auto: <strong>every 3 min</strong>
            </div>
          </div>
        </div>
      `;

      pinEl.addEventListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(infoContent);
          infoWindowRef.current.open({
            anchor: marker,
            map,
          });
        }
        if (onSelectStop) onSelectStop(node);
      });

      stopMarkersRef.current.push(marker);
    });
  };

  // Render User Location
  useEffect(() => {
    const map = mapInstanceRef.current;
    const googleMaps = (window as any).google?.maps;
    if (!map || !googleMaps) return;

    if (userMarkerRef.current) {
      if (userMarkerRef.current.map) userMarkerRef.current.map = null;
      if (userMarkerRef.current.setMap) userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }
    if (userCircleRef.current) {
      userCircleRef.current.setMap(null);
      userCircleRef.current = null;
    }

    if (!userLocation) return;

    const { lat, lng, accuracy } = userLocation;

    // Accuracy Circle
    userCircleRef.current = new googleMaps.Circle({
      map,
      center: { lat, lng },
      radius: Math.max(accuracy || 40, 25),
      strokeColor: '#3B82F6',
      strokeOpacity: 0.6,
      strokeWeight: 1.5,
      fillColor: '#60A5FA',
      fillOpacity: 0.2,
    });

    const userDot = document.createElement('div');
    userDot.style.width = '16px';
    userDot.style.height = '16px';
    userDot.style.borderRadius = '50%';
    userDot.style.backgroundColor = '#2563EB';
    userDot.style.border = '3px solid #FFFFFF';
    userDot.style.boxShadow = '0 0 10px rgba(37,99,235,0.8)';

    if (googleMaps.marker?.AdvancedMarkerElement) {
      userMarkerRef.current = new googleMaps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng },
        content: userDot,
        title: 'You are here',
      });
    } else {
      userMarkerRef.current = new googleMaps.Marker({
        map,
        position: { lat, lng },
        title: 'You are here',
      });
    }
  }, [userLocation]);

  // Render Selected Route Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const googleMaps = (window as any).google?.maps;
    if (!map || !googleMaps) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!selectedRoute || selectedRoute.legs.length === 0) return;

    const bounds = new googleMaps.LatLngBounds();

    selectedRoute.legs.forEach((leg) => {
      const p1 = { lat: leg.fromNode.lat, lng: leg.fromNode.lng };
      const p2 = { lat: leg.toNode.lat, lng: leg.toNode.lng };
      bounds.extend(p1);
      bounds.extend(p2);

      const colorMap = {
        walk: '#10B981',
        bus: '#E0554B',
        auto: '#F59E0B',
        cab: '#8B5CF6',
        transfer: '#94A3B8',
      };
      const legColor = colorMap[leg.mode] || '#E0554B';

      let polyline: any;

      if (leg.mode === 'walk') {
        const lineSymbol = {
          path: 'M 0,-1 0,1',
          strokeOpacity: 1,
          scale: 3,
          strokeColor: '#10B981',
        };
        polyline = new googleMaps.Polyline({
          path: [p1, p2],
          strokeOpacity: 0,
          icons: [
            {
              icon: lineSymbol,
              offset: '0',
              repeat: '14px',
            },
          ],
          map,
        });
      } else {
        polyline = new googleMaps.Polyline({
          path: [p1, p2],
          strokeColor: legColor,
          strokeOpacity: 0.9,
          strokeWeight: 6,
          map,
        });
      }

      polylinesRef.current.push(polyline);
    });

    // Standby Plan B branch
    if (selectedRoute.standbyLeg) {
      const sLeg = selectedRoute.standbyLeg;
      const sp1 = { lat: sLeg.fromNode.lat, lng: sLeg.fromNode.lng };
      const sp2 = { lat: sLeg.toNode.lat, lng: sLeg.toNode.lng };
      bounds.extend(sp1);
      bounds.extend(sp2);

      const dashedSymbol = {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        scale: 2.5,
        strokeColor: '#D97706',
      };

      const planBLine = new googleMaps.Polyline({
        path: [sp1, sp2],
        strokeOpacity: 0,
        icons: [{ icon: dashedSymbol, offset: '0', repeat: '12px' }],
        map,
      });
      polylinesRef.current.push(planBLine);
    }

    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [selectedRoute]);

  // Initialize Simulated Vehicles
  const initVehicles = () => {
    const nodeMap = new Map(NASHIK_NODES.map((n) => [n.id, n]));
    const list: SimulatedVehicle[] = [];

    // 1. Buses
    BUS_ROUTES.slice(0, 6).forEach((r, idx) => {
      const stops = r.stops
        .map((id) => nodeMap.get(id))
        .filter((n): n is TransitNode => !!n)
        .map((n) => ({ lat: n.lat, lng: n.lng }));

      if (stops.length >= 2) {
        list.push({
          id: `g_bus_${r.id}`,
          type: 'bus',
          label: r.number,
          color: r.color || '#E0554B',
          currentLat: stops[0].lat,
          currentLng: stops[0].lng,
          heading: calculateHeading(stops[0].lat, stops[0].lng, stops[1].lat, stops[1].lng),
          progress: (idx * 0.18) % 1.0,
          stops,
          speed: 0.0003 + (idx % 3) * 0.0001,
        });
      }
    });

    // 2. Shared Autos
    SHARED_AUTO_CORRIDORS.slice(0, 6).forEach((c, idx) => {
      const stops = c.stops
        .map((id) => nodeMap.get(id))
        .filter((n): n is TransitNode => !!n)
        .map((n) => ({ lat: n.lat, lng: n.lng }));

      if (stops.length >= 2) {
        list.push({
          id: `g_shared_${c.id}`,
          type: 'shared_auto',
          label: 'Shared',
          color: '#F59E0B',
          currentLat: stops[0].lat,
          currentLng: stops[0].lng,
          heading: calculateHeading(stops[0].lat, stops[0].lng, stops[1].lat, stops[1].lng),
          progress: (idx * 0.22) % 1.0,
          stops,
          speed: 0.0004 + (idx % 2) * 0.0001,
        });
      }
    });

    // 3. App Autos
    const appPairs = [
      ['dwarka_circle', 'ramkund'],
      ['nashik_cbs', 'college_road_byk'],
      ['mumbai_naka', 'city_centre_mall'],
      ['panchavati_karanja', 'shalimar'],
    ];
    appPairs.forEach(([sId, dId], idx) => {
      const s = nodeMap.get(sId);
      const d = nodeMap.get(dId);
      if (s && d) {
        list.push({
          id: `g_app_auto_${idx}`,
          type: 'app_auto',
          label: 'App Auto',
          color: '#EA580C',
          currentLat: s.lat,
          currentLng: s.lng,
          heading: calculateHeading(s.lat, s.lng, d.lat, d.lng),
          progress: (idx * 0.25) % 1.0,
          stops: [{ lat: s.lat, lng: s.lng }, { lat: d.lat, lng: d.lng }],
          speed: 0.00045,
        });
      }
    });

    // 4. Cabs
    const cabPairs = [
      ['nashik_cbs', 'nashik_road_stn'],
      ['dwarka_circle', 'city_centre_mall'],
      ['gangapur_road_nr_bhosala', 'mumbai_naka'],
      ['college_road_byk', 'ramkund'],
    ];
    cabPairs.forEach(([sId, dId], idx) => {
      const s = nodeMap.get(sId) || NASHIK_NODES[0];
      const d = nodeMap.get(dId) || NASHIK_NODES[1];
      list.push({
        id: `g_cab_${idx}`,
        type: 'cab',
        label: 'Cab',
        color: '#8B5CF6',
        currentLat: s.lat,
        currentLng: s.lng,
        heading: calculateHeading(s.lat, s.lng, d.lat, d.lng),
        progress: (idx * 0.3) % 1.0,
        stops: [{ lat: s.lat, lng: s.lng }, { lat: d.lat, lng: d.lng }],
        speed: 0.0005,
      });
    });

    setSimulatedVehicles(list);
  };

  // Movement interpolation loop
  useEffect(() => {
    if (!showSimulatedVehicles && !showSimulatedBuses) return;
    const map = mapInstanceRef.current;
    const googleMaps = (window as any).google?.maps;
    if (!map || !googleMaps) return;

    let localVehs = [...simulatedVehicles];

    const updateLoop = () => {
      localVehs = localVehs.map((veh) => {
        let nextProg = veh.progress + veh.speed;
        if (nextProg >= 1.0) nextProg = 0.0;

        const count = veh.stops.length;
        const segmentFloat = nextProg * (count - 1);
        const segIdx = Math.floor(segmentFloat);
        const segT = segmentFloat - segIdx;

        const p1 = veh.stops[segIdx] || veh.stops[0];
        const p2 = veh.stops[Math.min(segIdx + 1, count - 1)] || p1;

        const curLat = p1.lat + (p2.lat - p1.lat) * segT;
        const curLng = p1.lng + (p2.lng - p1.lng) * segT;
        const heading = calculateHeading(p1.lat, p1.lng, p2.lat, p2.lng);

        let marker = vehicleMarkersRef.current.get(veh.id);

        if (!marker) {
          const wrapper = document.createElement('div');
          wrapper.className = 'google-vehicle-symbol';
          wrapper.style.cursor = 'pointer';
          wrapper.style.transition = 'transform 0.15s ease-out';
          wrapper.innerHTML =
            veh.type === 'bus'
              ? VEHICLE_SVGS.bus(veh.color)
              : veh.type === 'shared_auto'
              ? VEHICLE_SVGS.shared_auto
              : veh.type === 'app_auto'
              ? VEHICLE_SVGS.app_auto
              : VEHICLE_SVGS.cab;

          if (googleMaps.marker?.AdvancedMarkerElement) {
            marker = new googleMaps.marker.AdvancedMarkerElement({
              map,
              position: { lat: curLat, lng: curLng },
              content: wrapper,
              title: veh.label,
            });
          } else {
            marker = new googleMaps.Marker({
              map,
              position: { lat: curLat, lng: curLng },
              title: veh.label,
            });
          }

          vehicleMarkersRef.current.set(veh.id, marker);
        } else {
          if (marker.position) {
            marker.position = { lat: curLat, lng: curLng };
          } else if (marker.setPosition) {
            marker.setPosition({ lat: curLat, lng: curLng });
          }
          if (marker.content) {
            marker.content.style.transform = `rotate(${heading}deg)`;
          }
        }

        return {
          ...veh,
          currentLat: curLat,
          currentLng: curLng,
          heading,
          progress: nextProg,
        };
      });

      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      vehicleMarkersRef.current.forEach((m) => {
        if (m.map) m.map = null;
        if (m.setMap) m.setMap(null);
      });
      vehicleMarkersRef.current.clear();
    };
  }, [showSimulatedVehicles, showSimulatedBuses, simulatedVehicles.length]);

  return (
    <div className={`relative w-full h-full min-h-[420px] rounded-[28px] overflow-hidden ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Simulated Live Feed Badge */}
      <div className="absolute top-4 right-4 z-20 bg-white/90 dark:bg-[#1F1B2B]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-md text-xs font-semibold flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
        <span className="text-[#3B2F4A] dark:text-[#F2EEF9]">Google Maps Live Feed (Simulated)</span>
      </div>

      {/* Map Legend Card */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:flex flex-col gap-1.5 bg-white/95 dark:bg-[#1F1B2B]/95 backdrop-blur-md p-3 rounded-2xl border border-black/5 dark:border-white/10 shadow-lg text-[11px] font-semibold text-[#3B2F4A] dark:text-[#F2EEF9]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#E0554B]" />
            <span>City Bus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#F59E0B]" />
            <span>Shared Auto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#EA580C]" />
            <span>App Auto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#8B5CF6]" />
            <span>Cab</span>
          </div>
        </div>
        <div className="text-[10px] text-[#7E708E] dark:text-[#9E94B3] border-t border-black/5 dark:border-white/5 pt-1">
          Simulated positions, not real GPS feeds • © OpenStreetMap contributors
        </div>
      </div>
    </div>
  );
};
