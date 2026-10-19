import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { BUS_ROUTES } from '../../data/busRoutes';
import { SHARED_AUTO_CORRIDORS } from '../../data/sharedAutoCorridors';
import { NASHIK_NODES } from '../../data/nashikNodes';
import { routingEngine } from '../../services/routing';
import { useIsDark } from '../../hooks/useIsDark';
import { JourneyRoute, TransitNode } from '../../types';
import { ViewportGridIndex } from '../../dsa/ViewportGridIndex';
import osmStopsData from '../../data/osmStops.generated.json';
import { TILE_PROVIDERS, evaluateTileFailover, TileProviderConfig } from './tileProviders';

export interface LeafletLiveMapProps {
  selectedRoute?: JourneyRoute | null;
  highlightedStopId?: string | null;
  onSelectStop?: (stop: TransitNode) => void;
  className?: string;
  showSimulatedBuses?: boolean;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  showSimulatedVehicles?: boolean;
  onDebugInfo?: (info: { tileProvider: string; tileErrorCount: number }) => void;
}

interface SimulatedVehicle {
  id: string;
  type: 'bus' | 'shared_auto' | 'app_auto' | 'cab';
  label: string;
  color: string;
  currentLat: number;
  currentLng: number;
  progress: number;
  stops: { lat: number; lng: number }[];
  speed: number;
}

export const LeafletLiveMap: React.FC<LeafletLiveMapProps> = ({
  selectedRoute,
  highlightedStopId,
  onSelectStop,
  className = '',
  showSimulatedBuses = true,
  userLocation,
  showSimulatedVehicles = true,
  onDebugInfo,
}) => {
  const isDarkMode = useIsDark();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const vehicleLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const gridIndexRef = useRef<ViewportGridIndex>(new ViewportGridIndex(0.015));

  const currentProviderIndexRef = useRef<number>(0);
  const errorTimesRef = useRef<number[]>([]);
  const loadTimesRef = useRef<number[]>([]);
  const [basemapUnavailable, setBasemapUnavailable] = useState<boolean>(false);
  const [tileErrorCount, setTileErrorCount] = useState<number>(0);
  const [activeProviderName, setActiveProviderName] = useState<string>(TILE_PROVIDERS[0].name);

  const [simulatedVehicles, setSimulatedVehicles] = useState<SimulatedVehicle[]>([]);

  // Initialize Spatial Grid with Core + Extended Nodes
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
        updateVisibleStops(mapInstanceRef.current);
      }
    });

    return () => unsub();
  }, []);

  // Update visible stop markers based on map bounds and zoom-tier culling
  const updateVisibleStops = (map: L.Map) => {
    if (!stopsLayerGroupRef.current) return;
    stopsLayerGroupRef.current.clearLayers();

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    const visibleNodes = gridIndexRef.current.queryBounds(
      {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      },
      zoom,
      400
    );

    visibleNodes.forEach((node) => {
      const isHub = node.type === 'junction' || node.type === 'railway' || node.tier === 'A';
      const markerSize = isHub ? 22 : 15;
      const markerColor =
        node.type === 'railway'
          ? '#8B5CF6'
          : node.type === 'landmark'
          ? '#F59E0B'
          : node.type === 'junction'
          ? '#E0554B'
          : '#10B981';

      const customHtml = `
        <div style="
          width: ${markerSize}px;
          height: ${markerSize}px;
          background: ${markerColor};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
        ">
          ${isHub ? '<div style="width: 5px; height: 5px; background: white; border-radius: 50%;"></div>' : ''}
        </div>
      `;

      const icon = L.divIcon({
        html: customHtml,
        className: 'clay-stop-marker',
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const marker = L.marker([node.lat, node.lng], { icon });

      const routesList = (node.serves && node.serves.length > 0) ? node.serves.join(', ') : 'Feeder / Auto';
      const popupHtml = `
        <div style="font-family: 'Onest', sans-serif; padding: 6px; min-width: 190px;">
          <h4 style="font-weight: 700; font-size: 13px; color: #3B2F4A; margin-bottom: 2px;">${node.name}</h4>
          <p style="font-size: 11px; color: #E0554B; font-weight: 600; margin-bottom: 6px;">${node.nameMr || ''}</p>
          <div style="font-size: 11px; color: #555; margin-bottom: 4px;">
            <strong>Serves Routes:</strong> ${routesList}
          </div>
          <div style="background: #F3F0F7; padding: 6px; border-radius: 8px; margin-top: 6px;">
            <div style="font-size: 10px; font-weight: 700; color: #6B21A8; text-transform: uppercase;">Next Departures:</div>
            <div style="font-size: 11px; color: #333; margin-top: 2px;">
              • Route 101: <strong>in 4 min</strong><br/>
              • Route 204: <strong>in 11 min</strong><br/>
              • Seat Auto: <strong>every 3 min</strong>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        if (onSelectStop) onSelectStop(node);
      });

      stopsLayerGroupRef.current?.addLayer(marker);
    });
  };

  // Helper to create and attach tile layer for a given provider
  const createTileLayerForProvider = (
    provider: TileProviderConfig,
    map: L.Map,
    onTileError: () => void,
    onTileLoad: () => void
  ): L.TileLayer => {
    const options: L.TileLayerOptions = {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom || 19,
      detectRetina: true,
      keepBuffer: 4,
      updateWhenIdle: true,
    };
    if (provider.subdomains) {
      options.subdomains = provider.subdomains;
    }

    const layer = L.tileLayer(provider.url, options);
    layer.on('tileerror', onTileError);
    layer.on('tileload', onTileLoad);
    layer.addTo(map);
    return layer;
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.9975, 73.7898],
      zoom: 13,
      zoomControl: true,
    });

    const handleTileLoad = () => {
      const now = Date.now();
      loadTimesRef.current.push(now);
      const cutoff = now - 10000;
      loadTimesRef.current = loadTimesRef.current.filter((t) => t >= cutoff);
      errorTimesRef.current = errorTimesRef.current.filter((t) => t >= cutoff);
    };

    const handleTileError = () => {
      const now = Date.now();
      errorTimesRef.current.push(now);
      setTileErrorCount((c) => {
        const next = c + 1;
        if (onDebugInfo) {
          onDebugInfo({
            tileProvider: TILE_PROVIDERS[currentProviderIndexRef.current]?.name || 'Unknown',
            tileErrorCount: next,
          });
        }
        return next;
      });

      const cutoff = now - 10000;
      errorTimesRef.current = errorTimesRef.current.filter((t) => t >= cutoff);
      loadTimesRef.current = loadTimesRef.current.filter((t) => t >= cutoff);

      const decision = evaluateTileFailover(
        currentProviderIndexRef.current,
        errorTimesRef.current.length,
        loadTimesRef.current.length,
        6,
        TILE_PROVIDERS.length
      );

      if (decision.shouldFailover && decision.nextIndex !== null) {
        const nextProvider = TILE_PROVIDERS[decision.nextIndex];
        console.warn(
          `[GodaGraph] Basemap tile failure threshold reached on ${TILE_PROVIDERS[currentProviderIndexRef.current].name}. Failing over to: ${nextProvider.name}`
        );
        currentProviderIndexRef.current = decision.nextIndex;
        errorTimesRef.current = [];
        loadTimesRef.current = [];
        setActiveProviderName(nextProvider.name);
        if (onDebugInfo) {
          onDebugInfo({
            tileProvider: nextProvider.name,
            tileErrorCount: tileErrorCount + 1,
          });
        }

        if (tileLayerRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(tileLayerRef.current);
          tileLayerRef.current = createTileLayerForProvider(
            nextProvider,
            mapInstanceRef.current,
            handleTileError,
            handleTileLoad
          );
        }
      } else if (decision.allFailed) {
        console.warn('[GodaGraph] All configured keyless tile providers failed.');
        setBasemapUnavailable(true);
      }
    };

    const initialProvider = TILE_PROVIDERS[0];
    setActiveProviderName(initialProvider.name);
    if (onDebugInfo) {
      onDebugInfo({
        tileProvider: initialProvider.name,
        tileErrorCount: 0,
      });
    }

    const tileLayer = createTileLayerForProvider(
      initialProvider,
      map,
      handleTileError,
      handleTileLoad
    );
    tileLayerRef.current = tileLayer;

    routeLayerGroupRef.current = L.layerGroup().addTo(map);
    stopsLayerGroupRef.current = L.layerGroup().addTo(map);
    vehicleLayerGroupRef.current = L.layerGroup().addTo(map);
    userLocLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Viewport debounced update on moveend / zoomend
    let debounceTimer: any = null;
    const handleMove = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        updateVisibleStops(map);
      }, 150);
    };

    map.on('moveend', handleMove);
    map.on('zoomend', handleMove);

    updateVisibleStops(map);
    initSimulatedVehicles();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      clearTimeout(debounceTimer);
      if (tileLayerRef.current) {
        tileLayerRef.current.off('tileerror');
        tileLayerRef.current.off('tileload');
      }
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Render User Location Blue Dot & Accuracy Circle
  useEffect(() => {
    if (!userLocLayerGroupRef.current) return;
    userLocLayerGroupRef.current.clearLayers();

    if (!userLocation) return;

    const { lat, lng, accuracy } = userLocation;

    // Accuracy Circle
    L.circle([lat, lng], {
      radius: Math.max(accuracy || 40, 25),
      color: '#3B82F6',
      fillColor: '#60A5FA',
      fillOpacity: 0.18,
      weight: 1.5,
    }).addTo(userLocLayerGroupRef.current);

    // Blue "You Are Here" dot
    const userDotIcon = L.divIcon({
      html: `
        <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background: #3B82F6; opacity: 0.4; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background: #2563EB; border: 2.5px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.35);"></div>
        </div>
      `,
      className: 'user-location-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const userMarker = L.marker([lat, lng], { icon: userDotIcon }).addTo(userLocLayerGroupRef.current);
    userMarker.bindTooltip('You are here', { permanent: false, direction: 'top' });
  }, [userLocation]);

  // Initialize Simulated Vehicles (Buses, Shared Autos, App Autos, Cabs)
  const initSimulatedVehicles = () => {
    const nodeMap = new Map(NASHIK_NODES.map((n) => [n.id, n]));
    const vehicles: SimulatedVehicle[] = [];

    // 1. City Buses
    const activeRoutes = BUS_ROUTES.slice(0, 6);
    activeRoutes.forEach((route, idx) => {
      const stopNodes = route.stops
        .map((id) => nodeMap.get(id))
        .filter((n): n is TransitNode => !!n);

      if (stopNodes.length >= 2) {
        vehicles.push({
          id: `bus_${route.id}`,
          type: 'bus',
          label: `🚌 ${route.number}`,
          color: route.color || '#E0554B',
          currentLat: stopNodes[0].lat,
          currentLng: stopNodes[0].lng,
          progress: (idx * 0.18) % 1.0,
          stops: stopNodes.map((n) => ({ lat: n.lat, lng: n.lng })),
          speed: 0.0003 + (idx % 3) * 0.0001,
        });
      }
    });

    // 2. Shared Autos along corridors
    const activeCorridors = SHARED_AUTO_CORRIDORS.slice(0, 6);
    activeCorridors.forEach((corridor, idx) => {
      const stopNodes = corridor.stops
        .map((id) => nodeMap.get(id))
        .filter((n): n is TransitNode => !!n);

      if (stopNodes.length >= 2) {
        vehicles.push({
          id: `shared_auto_${corridor.id}`,
          type: 'shared_auto',
          label: '🛺 Shared',
          color: '#F59E0B',
          currentLat: stopNodes[0].lat,
          currentLng: stopNodes[0].lng,
          progress: (idx * 0.22) % 1.0,
          stops: stopNodes.map((n) => ({ lat: n.lat, lng: n.lng })),
          speed: 0.0004 + (idx % 2) * 0.0001,
        });
      }
    });

    // 3. App Autos (Uber/Ola auto)
    const hubPairs = [
      ['dwarka_circle', 'ramkund'],
      ['nashik_cbs', 'college_road_byk'],
      ['mumbai_naka', 'city_centre_mall'],
      ['panchavati_karanja', 'shalimar'],
    ];
    hubPairs.forEach(([sId, dId], idx) => {
      const s = nodeMap.get(sId);
      const d = nodeMap.get(dId);
      if (s && d) {
        vehicles.push({
          id: `app_auto_${idx}`,
          type: 'app_auto',
          label: '🛺 App Auto',
          color: '#EA580C',
          currentLat: s.lat,
          currentLng: s.lng,
          progress: (idx * 0.25) % 1.0,
          stops: [{ lat: s.lat, lng: s.lng }, { lat: d.lat, lng: d.lng }],
          speed: 0.00045,
        });
      }
    });

    // 4. Cabs (Uber/Ola cab)
    const cabPairs = [
      ['nashik_cbs', 'nashik_road_stn'],
      ['dwarka_circle', 'city_centre_mall'],
      ['gangapur_road_nr_bhosala', 'mumbai_naka'],
      ['college_road_byk', 'ramkund'],
    ];
    cabPairs.forEach(([sId, dId], idx) => {
      const s = nodeMap.get(sId) || NASHIK_NODES[0];
      const d = nodeMap.get(dId) || NASHIK_NODES[1];
      vehicles.push({
        id: `cab_${idx}`,
        type: 'cab',
        label: '🚕 Cab',
        color: '#8B5CF6',
        currentLat: s.lat,
        currentLng: s.lng,
        progress: (idx * 0.3) % 1.0,
        stops: [{ lat: s.lat, lng: s.lng }, { lat: d.lat, lng: d.lng }],
        speed: 0.0005,
      });
    });

    setSimulatedVehicles(vehicles);
  };

  // Update Route Polyline
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerGroupRef.current) return;
    const map = mapInstanceRef.current;
    const routeLayer = routeLayerGroupRef.current;
    routeLayer.clearLayers();

    if (!selectedRoute || selectedRoute.legs.length === 0) return;

    const allRoutePoints: [number, number][] = [];

    selectedRoute.legs.forEach((leg) => {
      const p1: [number, number] = [leg.fromNode.lat, leg.fromNode.lng];
      const p2: [number, number] = [leg.toNode.lat, leg.toNode.lng];
      allRoutePoints.push(p1);
      allRoutePoints.push(p2);

      const colorMap = {
        walk: '#10B981',
        bus: '#E0554B',
        auto: '#F59E0B',
        cab: '#8B5CF6',
        transfer: '#94A3B8',
      };

      const legColor = colorMap[leg.mode] || '#E0554B';
      const isDashed = leg.mode === 'walk';

      const polyline = L.polyline([p1, p2], {
        color: legColor,
        weight: leg.mode === 'walk' ? 4 : 6,
        dashArray: isDashed ? '6, 8' : undefined,
        opacity: 0.9,
      }).addTo(routeLayer);

      polyline.bindTooltip(
        `${leg.mode.toUpperCase()}: ${leg.fromNode.name} → ${leg.toNode.name} (${Math.round(leg.minutes)}m)`,
        { sticky: true }
      );
    });

    // Standby Plan B
    if (selectedRoute.standbyLeg) {
      const sLeg = selectedRoute.standbyLeg;
      const sp1: [number, number] = [sLeg.fromNode.lat, sLeg.fromNode.lng];
      const sp2: [number, number] = [sLeg.toNode.lat, sLeg.toNode.lng];

      L.polyline([sp1, sp2], {
        color: '#D97706',
        weight: 4,
        dashArray: '4, 6',
        opacity: 0.85,
      })
        .addTo(routeLayer)
        .bindTooltip(`Plan B Standby Auto: ${sLeg.fromNode.name} → ${sLeg.toNode.name}`, { sticky: true });
    }

    if (allRoutePoints.length > 0) {
      const travelIcon = L.divIcon({
        html: `
          <div style="
            width: 18px;
            height: 18px;
            background: #E0554B;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 14px #E0554B;
            animation: pulse 1.2s infinite;
          "></div>
        `,
        className: 'travelling-dot',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker(allRoutePoints[0], { icon: travelIcon }).addTo(routeLayer);

      const bounds = L.latLngBounds(allRoutePoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [selectedRoute]);

  // Live Vehicle Simulation Movement Loop
  useEffect(() => {
    if (!showSimulatedVehicles && !showSimulatedBuses) return;
    if (!vehicleLayerGroupRef.current) return;

    let localVehicles = [...simulatedVehicles];

    const updateVehicles = () => {
      if (!vehicleLayerGroupRef.current) return;
      vehicleLayerGroupRef.current.clearLayers();

      localVehicles = localVehicles.map((veh) => {
        let nextProgress = veh.progress + veh.speed;
        if (nextProgress >= 1.0) nextProgress = 0.0;

        const count = veh.stops.length;
        const segmentFloat = nextProgress * (count - 1);
        const segIdx = Math.floor(segmentFloat);
        const segT = segmentFloat - segIdx;

        const p1 = veh.stops[segIdx] || veh.stops[0];
        const p2 = veh.stops[Math.min(segIdx + 1, count - 1)] || p1;

        const curLat = p1.lat + (p2.lat - p1.lat) * segT;
        const curLng = p1.lng + (p2.lng - p1.lng) * segT;

        const iconHtml = `
          <div style="
            display: flex;
            align-items: center;
            gap: 3px;
            background: ${veh.color};
            color: white;
            padding: 2px 6px;
            border-radius: 9999px;
            font-family: 'Onest', sans-serif;
            font-size: 10px;
            font-weight: 700;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            border: 1.5px solid white;
            white-space: nowrap;
          ">
            <span>${veh.label}</span>
          </div>
        `;

        const vehIcon = L.divIcon({
          html: iconHtml,
          className: 'simulated-vehicle-icon',
          iconSize: [54, 22],
          iconAnchor: [27, 11],
        });

        const marker = L.marker([curLat, curLng], { icon: vehIcon });
        marker.bindTooltip(`${veh.label} (Simulated)`, { sticky: true });
        vehicleLayerGroupRef.current?.addLayer(marker);

        return {
          ...veh,
          currentLat: curLat,
          currentLng: curLng,
          progress: nextProgress,
        };
      });

      animFrameRef.current = requestAnimationFrame(updateVehicles);
    };

    animFrameRef.current = requestAnimationFrame(updateVehicles);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [showSimulatedVehicles, showSimulatedBuses, simulatedVehicles.length]);

  return (
    <div className={`relative w-full h-full min-h-[420px] rounded-[28px] overflow-hidden ${className}`}>
      <div
        ref={mapContainerRef}
        className={`w-full h-full z-10 ${isDarkMode ? 'gg-dark-tiles' : ''}`}
      />

      {/* Basemap temporary unavailable warning if all providers fail */}
      {basemapUnavailable && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-amber-500/95 dark:bg-amber-600/95 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg font-medium backdrop-blur-sm pointer-events-none">
          Basemap temporarily unavailable
        </div>
      )}

      {/* Simulated Live Feed Badge */}
      <div className="absolute top-4 right-4 z-20 bg-white/90 dark:bg-[#1F1B2B]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-md text-xs font-semibold flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
        <span className="text-[#3B2F4A] dark:text-[#F2EEF9]">Live Transit Feed (Simulated)</span>
      </div>

      {/* Map Legend & Attribution */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:flex flex-col gap-1.5 bg-white/95 dark:bg-[#1F1B2B]/95 backdrop-blur-md p-3 rounded-2xl border border-black/5 dark:border-white/10 shadow-lg text-[11px] font-semibold text-[#3B2F4A] dark:text-[#F2EEF9]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#E0554B]" />
            <span>Bus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#F59E0B]" />
            <span>Auto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#8B5CF6]" />
            <span>Cab</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 border-b-2 border-dashed border-[#10B981]" />
            <span>Walk</span>
          </div>
        </div>
        <div className="text-[10px] text-[#7E708E] dark:text-[#9E94B3] border-t border-black/5 dark:border-white/5 pt-1">
          Simulated positions, not real GPS feeds • © OpenStreetMap contributors
        </div>
      </div>
    </div>
  );
};
