import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Search,
  Mic,
  Clock,
  Sparkles,
  CloudRain,
  Flame,
  Share2,
  Bookmark,
  Printer,
  ChevronDown,
  ChevronUp,
  Sliders,
  Check,
  Footprints,
  Bus,
  Car,
  ShieldCheck,
  Leaf,
  Info,
} from 'lucide-react';
import { ClayCard, ClayButton, ClayInput, ClayChip, ClayToggle, ClayModal } from '../components/clay';
import { LiveMap } from '../components/map/LiveMap';
import { routingEngine } from '../services/routing';
import { geminiService } from '../services/gemini';
import { NASHIK_NODES } from '../data/nashikNodes';
import { TransitNode, JourneyRoute } from '../types';
import {
  isWithinNashikBounds,
  hasMovedSignificantly,
  evaluateLocationFix,
} from '../services/liveLocationHelper';
import {
  resolveNearestKnownPlace,
  coordinateFallbackName,
  reverseGeocode,
  assembleAndTrimParts,
  isEligibleForLocationName,
} from '../services/geocode';

export interface PlanPageProps {
  currentLang: 'en' | 'mr' | 'hi';
}

export const PlanPage: React.FC<PlanPageProps> = ({ currentLang }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search Inputs & Trie Autocomplete States
  const [sourceQuery, setSourceQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<TransitNode | null>(null);
  const [selectedDest, setSelectedDest] = useState<TransitNode | null>(null);

  const [sourceCompletions, setSourceCompletions] = useState<any[]>([]);
  const [destCompletions, setDestCompletions] = useState<any[]>([]);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  // Live Location & GPS state
  const [gpsButtonText, setGpsButtonText] = useState('📍 Use my GPS location');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const isAutoFollowingRef = useRef<boolean>(false);
  const lastFixRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const selectedSourceRef = useRef<TransitNode | null>(null);
  selectedSourceRef.current = selectedSource;
  const selectedDestRef = useRef<TransitNode | null>(null);
  selectedDestRef.current = selectedDest;
  const [extReadyTick, setExtReadyTick] = useState<number>(0);
  const geocodeReqCounter = useRef<number>(0);
  const lastPlannedParamsRef = useRef<string>('');
  const hasShownBlockedRef = useRef<boolean>(false);
  const [useGoogleGeocoding, setUseGoogleGeocoding] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data?.useGoogleGeocoding) {
          setUseGoogleGeocoding(true);
        }
      })
      .catch(() => {});
  }, []);

  // Preference Toggles & Environmental Context
  const [isRainy, setIsRainy] = useState(false);
  const [isKumbhFestival, setIsKumbhFestival] = useState(false);
  const [selectedTimeType, setSelectedTimeType] = useState<'now' | 'leave_at'>('now');
  const [timePickerValue, setTimePickerValue] = useState('09:30');
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  const [weightTime, setWeightTime] = useState(0.5);
  const [weightCost, setWeightCost] = useState(0.5);
  const [weightComfort, setWeightComfort] = useState(0.5);
  const [weightWalk, setWeightWalk] = useState(0.5);

  // NLP AI Input Box
  const [nlpQuery, setNlpQuery] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpButtonText, setNlpButtonText] = useState<string | null>(null);

  // Journey Results
  const [routes, setRoutes] = useState<JourneyRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<JourneyRoute | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [localFriendAdvice, setLocalFriendAdvice] = useState<string>('');
  const [loadingAdvice, setLoadingAdvice] = useState<boolean>(false);

  // Request counter & cache key for Local Friend tips
  const localFriendReqCounter = useRef<number>(0);
  const lastRequestedTipRef = useRef<string>('');

  // Favourites & Notifications
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Stop watching on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Subscribe to Extended Layer readiness to refresh any open autocomplete dropdown and replan non-core routes
  useEffect(() => {
    const wasReadyAtSubscribe = routingEngine.isExtendedReady;
    const unsub = routingEngine.onExtendedReady(() => {
      if (showSourceDropdown && sourceQuery.trim()) {
        const matches = routingEngine.searchPlaces(sourceQuery);
        setSourceCompletions(matches.slice(0, 8));
      }
      if (showDestDropdown && destQuery.trim()) {
        const matches = routingEngine.searchPlaces(destQuery);
        setDestCompletions(matches.slice(0, 8));
      }

      if (!wasReadyAtSubscribe) {
        const srcId = selectedSourceRef.current?.id;
        const dstId = selectedDestRef.current?.id;
        const isSrcNonCore = srcId ? !routingEngine.graph.nodes.has(srcId) : false;
        const isDstNonCore = dstId ? !routingEngine.graph.nodes.has(dstId) : false;

        if (isSrcNonCore || isDstNonCore) {
          lastPlannedParamsRef.current = '';
          setExtReadyTick((t) => t + 1);
        }
      }
    });
    return () => unsub();
  }, [showSourceDropdown, showDestDropdown, sourceQuery, destQuery]);

  // Reverse Geocoding with Google Maps Geocoder (when enabled and available)
  const reverseGeocodeGoogle = async (lat: number, lng: number): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const GeocoderClass = (window as any).google?.maps?.Geocoder;
        if (!GeocoderClass) return resolve(null);
        const geocoder = new GeocoderClass();
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results && results.length > 0) {
            const preferredTypes = ['premise', 'point_of_interest', 'establishment', 'neighborhood', 'route'];
            let bestResult = results[0];
            for (const pType of preferredTypes) {
              const match = results.find((r: any) => r.types && r.types.includes(pType));
              if (match) {
                bestResult = match;
                break;
              }
            }
            let primary = '';
            let area = '';
            let city = 'Nashik';
            for (const comp of bestResult.address_components || []) {
              const types = comp.types || [];
              if (
                !primary &&
                (types.includes('point_of_interest') ||
                  types.includes('establishment') ||
                  types.includes('premise') ||
                  types.includes('route'))
              ) {
                primary = comp.long_name;
              }
              if (
                !area &&
                (types.includes('sublocality') ||
                  types.includes('neighborhood') ||
                  types.includes('sublocality_level_1'))
              ) {
                area = comp.long_name;
              }
              if (types.includes('locality')) {
                city = comp.long_name;
              }
            }
            if (!primary) primary = bestResult.formatted_address?.split(',')[0] || '';
            const name = assembleAndTrimParts(primary, area, city, 48);
            resolve(name || null);
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  };

  // 1D. Apply live place name with multi-stage resolution
  const applyLivePlaceName = async (lat: number, lng: number) => {
    const reqId = ++geocodeReqCounter.current;

    // Step 1 (instant): resolve nearest known place using extended layer if ready, else NASHIK_NODES; if null, coordinate fallback
    const rawCandidates = routingEngine.isExtendedReady
      ? routingEngine.extGraph.getAllNodes()
      : NASHIK_NODES;
    const candidates = rawCandidates.filter(
      (node) => node.id !== 'my_live_location' && isEligibleForLocationName(node)
    );
    const nearest = resolveNearestKnownPlace(lat, lng, candidates);
    const instantName = nearest || coordinateFallbackName(lat, lng);

    const instantNode = routingEngine.setLiveNodeNames({ name: instantName });
    if (instantNode) {
      setSelectedSource({ ...instantNode });
    }
    setSourceQuery(instantName);
    setShowSourceDropdown(false);

    // Step 2 (background): reverseGeocode(lat, lng, 'en') (or Google geocoding if enabled)
    try {
      let resolvedEnName: string | null = null;
      if (useGoogleGeocoding && (window as any).google?.maps?.Geocoder) {
        resolvedEnName = await reverseGeocodeGoogle(lat, lng);
      }
      if (!resolvedEnName) {
        resolvedEnName = await reverseGeocode(lat, lng, 'en');
      }

      // Apply ONLY IF selected source is still my_live_location, user hasn't changed source, and request is latest
      if (
        resolvedEnName &&
        geocodeReqCounter.current === reqId &&
        isAutoFollowingRef.current &&
        selectedSourceRef.current?.id === 'my_live_location'
      ) {
        const bgNode = routingEngine.setLiveNodeNames({ name: resolvedEnName });
        if (bgNode) {
          setSelectedSource({ ...bgNode });
        }
        setSourceQuery(resolvedEnName);
        setShowSourceDropdown(false);

        // Step 3: if UI language is 'mr' or 'hi', also fetch that language and store in nameMr / nameHi
        if (currentLang === 'mr' || currentLang === 'hi') {
          reverseGeocode(lat, lng, currentLang).then((langName) => {
            if (
              langName &&
              geocodeReqCounter.current === reqId &&
              isAutoFollowingRef.current &&
              selectedSourceRef.current?.id === 'my_live_location'
            ) {
              const names =
                currentLang === 'mr'
                  ? { name: resolvedEnName!, nameMr: langName }
                  : { name: resolvedEnName!, nameHi: langName };
              const langNode = routingEngine.setLiveNodeNames(names);
              if (langNode) {
                setSelectedSource({ ...langNode });
              }
            }
          });
        }
      }
    } catch {
      // Quiet background fallback
    }
  };

  // Shared fix handler implementing "first fix wins once" and 75m / 10s rules
  const processLocationFix = (latitude: number, longitude: number, accuracy?: number) => {
    const now = Date.now();
    const currentState = {
      hasReceivedFirstFix: Boolean(lastFixRef.current),
      lastLat: lastFixRef.current?.lat,
      lastLng: lastFixRef.current?.lng,
      lastTime: lastFixRef.current?.time,
    };

    const decision = evaluateLocationFix(
      currentState,
      latitude,
      longitude,
      now,
      isAutoFollowingRef.current
    );

    if (!decision.accepted) return;

    setUserLocation({ lat: latitude, lng: longitude, accuracy });
    lastFixRef.current = { lat: latitude, lng: longitude, time: now };

    const liveNode = routingEngine.upsertLiveNode(latitude, longitude);
    setSelectedSource(liveNode);
    applyLivePlaceName(latitude, longitude);
  };

  // Request and watch live location
  const handleLocationBlocked = () => {
    if (hasShownBlockedRef.current || lastFixRef.current) return;
    hasShownBlockedRef.current = true;
    setGpsButtonText('📍 Location blocked, using Dwarka');
    setTimeout(() => {
      setGpsButtonText('📍 Use my GPS location');
      hasShownBlockedRef.current = false;
    }, 3000);
  };

  const startWatchingLocation = () => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isAutoFollowingRef.current) return;
        const { latitude, longitude, accuracy } = pos.coords;
        processLocationFix(latitude, longitude, accuracy);
      },
      (err) => {
        console.warn('watchPosition error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  };

  const requestLiveLocation = async (isManualClick: boolean = false) => {
    if (!navigator.geolocation) {
      handleLocationBlocked();
      return;
    }

    if (!isManualClick && (navigator as any).permissions?.query) {
      try {
        const status = await (navigator as any).permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          return; // Do not prompt again when denied
        }
      } catch {
        // Permissions API error, proceed
      }
    }

    isAutoFollowingRef.current = true;

    // Issue 5.1: start watch immediately after permission is not "denied" (for manual click, always)
    startWatchingLocation();

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        processLocationFix(latitude, longitude, accuracy);
      },
      (err) => {
        console.warn('Geolocation getCurrentPosition error:', err);
        setTimeout(() => {
          if (!lastFixRef.current) {
            handleLocationBlocked();
          }
        }, 1500);
      },
      options
    );
  };

  // Initialize from URL search parameters if available
  useEffect(() => {
    const fromId = searchParams.get('from');
    const toId = searchParams.get('to');

    if (fromId) {
      const found = NASHIK_NODES.find((n) => n.id === fromId);
      if (found) {
        setSelectedSource(found);
        setSourceQuery(found.name);
      }
    } else {
      // Default initial stop is Dwarka Circle; also request live location automatically
      const dwarka = NASHIK_NODES.find((n) => n.id === 'dwarka_circle');
      if (dwarka) {
        setSelectedSource(dwarka);
        setSourceQuery(dwarka.name);
      }
      requestLiveLocation(false);
    }

    if (toId) {
      const found = NASHIK_NODES.find((n) => n.id === toId);
      if (found) {
        setSelectedDest(found);
        setDestQuery(found.name);
      }
    } else {
      const ramkund = NASHIK_NODES.find((n) => n.id === 'ramkund');
      if (ramkund) {
        setSelectedDest(ramkund);
        setDestQuery(ramkund.name);
      }
    }
  }, [searchParams]);

  // Execute routing plan whenever source/dest or key flags change
  useEffect(() => {
    if (!selectedSource || !selectedDest || selectedSource.id === selectedDest.id) {
      setRoutes([]);
      setSelectedRoute(null);
      lastPlannedParamsRef.current = '';
      return;
    }

    let depMinute = 570; // 09:30 AM
    if (selectedTimeType === 'now') {
      const now = new Date();
      depMinute = now.getHours() * 60 + now.getMinutes();
    } else {
      const [h, m] = timePickerValue.split(':').map(Number);
      depMinute = (h || 9) * 60 + (m || 0);
    }

    // Skip extra routing computation and Local Friend request if only place name changed
    const planKey = `${selectedSource.id}:${selectedSource.lat}:${selectedSource.lng}->${selectedDest.id}:${depMinute}:${isRainy}:${isKumbhFestival}:${weightTime}:${weightCost}:${weightComfort}:${weightWalk}`;
    if (lastPlannedParamsRef.current === planKey) {
      return;
    }
    lastPlannedParamsRef.current = planKey;

    try {
      const calculatedRoutes = routingEngine.planJourney(selectedSource.id, selectedDest.id, {
        departureMinuteOfDay: depMinute,
        isRainy,
        isKumbhFestival,
        userWeightTime: weightTime,
        userWeightCost: weightCost,
        userWeightComfort: weightComfort,
        userWeightWalk: weightWalk,
      });

      setRoutes(calculatedRoutes);
      if (calculatedRoutes.length > 0) {
        setSelectedRoute(calculatedRoutes[0]);
        setExpandedRouteId(calculatedRoutes[0].id);
        fetchLocalFriendTip(calculatedRoutes[0]);
      } else {
        setSelectedRoute(null);
      }
    } catch (err: any) {
      setRoutes([]);
      setSelectedRoute(null);
      lastPlannedParamsRef.current = '';
      console.warn(err?.message || String(err));
    }
  }, [selectedSource, selectedDest, isRainy, isKumbhFestival, selectedTimeType, timePickerValue, weightTime, weightCost, weightComfort, weightWalk, extReadyTick]);

  // Autocomplete search triggers using searchPlaces capped at 8
  const handleSourceChange = (val: string) => {
    setSourceQuery(val);
    isAutoFollowingRef.current = false;
    if (val.trim().length > 0) {
      const matches = routingEngine.searchPlaces(val);
      setSourceCompletions(matches.slice(0, 8));
      setShowSourceDropdown(true);
    } else {
      setSourceCompletions([]);
      setShowSourceDropdown(false);
    }
  };

  const handleDestChange = (val: string) => {
    setDestQuery(val);
    if (val.trim().length > 0) {
      const matches = routingEngine.searchPlaces(val);
      setDestCompletions(matches.slice(0, 8));
      setShowDestDropdown(true);
    } else {
      setDestCompletions([]);
      setShowDestDropdown(false);
    }
  };

  // Swap Source and Destination
  const handleSwap = () => {
    isAutoFollowingRef.current = false;
    const tempNode = selectedSource;
    const tempQuery = sourceQuery;
    setSelectedSource(selectedDest);
    setSourceQuery(destQuery);
    setSelectedDest(tempNode);
    setDestQuery(tempQuery);
  };

  // Web Speech API Voice Input
  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = currentLang === 'mr' ? 'mr-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNlpQuery(transcript);
      handleNlpSubmit(transcript);
    };
  };

  // Helper to resolve stop names with exact match, word match, or fuzzy trie search
  const resolveStopName = (name: string): TransitNode | null => {
    if (!name || !name.trim()) return null;
    const direct = routingEngine.searchPlaces(name.trim());
    if (direct && direct.length > 0) {
      return direct[0].node;
    }
    const words = name.trim().split(/\s+/).filter((w) => w.length >= 3);
    for (const word of words) {
      const wordMatches = routingEngine.searchPlaces(word);
      if (wordMatches && wordMatches.length > 0) {
        return wordMatches[0].node;
      }
    }
    const fuzzy = routingEngine.trie.fuzzySearch(name.trim(), 3);
    if (fuzzy && fuzzy.length > 0) {
      return fuzzy[0].node;
    }
    return null;
  };

  // Natural Language Trip parser via Gemini
  const handleNlpSubmit = async (queryText?: string) => {
    const text = queryText || nlpQuery;
    if (!text.trim()) return;

    setNlpLoading(true);
    try {
      const parsed = await geminiService.parseTripQuery(text);

      let matchedAny = false;

      if (parsed.source) {
        const matched = resolveStopName(parsed.source);
        if (matched) {
          isAutoFollowingRef.current = false;
          setSelectedSource(matched);
          setSourceQuery(matched.name);
          matchedAny = true;
        }
      }

      if (parsed.destination) {
        const matched = resolveStopName(parsed.destination);
        if (matched) {
          setSelectedDest(matched);
          setDestQuery(matched.name);
          matchedAny = true;
        }
      }

      if (parsed.preferences === 'fastest') {
        setWeightTime(0.9);
        setWeightCost(0.3);
        setWeightComfort(0.4);
        setWeightWalk(0.4);
      } else if (parsed.preferences === 'cheapest') {
        setWeightTime(0.3);
        setWeightCost(0.9);
        setWeightComfort(0.4);
        setWeightWalk(0.4);
      } else if (parsed.preferences === 'least_walking') {
        setWeightTime(0.4);
        setWeightCost(0.4);
        setWeightComfort(0.6);
        setWeightWalk(0.95);
      } else if (parsed.preferences === 'balanced') {
        setWeightTime(0.5);
        setWeightCost(0.5);
        setWeightComfort(0.5);
        setWeightWalk(0.5);
      }

      if (!matchedAny) {
        setNlpButtonText("Couldn't find stops");
        setTimeout(() => setNlpButtonText(null), 2000);
      }
    } finally {
      setNlpLoading(false);
    }
  };

  // Fetch Local Friend advice for selected route
  const fetchLocalFriendTip = async (route: JourneyRoute | null) => {
    if (!route) return;
    const reqKey = `${route.id}_${currentLang}`;
    if (lastRequestedTipRef.current === reqKey) return;
    lastRequestedTipRef.current = reqKey;

    const reqId = ++localFriendReqCounter.current;
    setLoadingAdvice(true);
    try {
      const summary = {
        title: route.title,
        minutes: route.totalMinutes,
        fare: route.totalCostInr,
        transfers: route.transfersCount,
        steps: route.legs.map((l) => `${l.mode} from ${l.fromNode.name} to ${l.toNode.name}`),
      };
      const tip = await geminiService.getLocalFriendExplanation(summary, currentLang);
      if (reqId === localFriendReqCounter.current) {
        setLocalFriendAdvice(tip);
      }
    } finally {
      if (reqId === localFriendReqCounter.current) {
        setLoadingAdvice(false);
      }
    }
  };

  useEffect(() => {
    if (selectedRoute) {
      fetchLocalFriendTip(selectedRoute);
    }
  }, [selectedRoute?.id, currentLang]);

  // Share link: when source is live node, share destination only
  const handleShare = () => {
    if (!selectedDest) return;
    let url = '';
    if (selectedSource?.id === 'my_live_location') {
      url = `${window.location.origin}/plan?to=${selectedDest.id}`;
    } else if (selectedSource) {
      url = `${window.location.origin}/plan?from=${selectedSource.id}&to=${selectedDest.id}`;
    } else {
      url = `${window.location.origin}/plan?to=${selectedDest.id}`;
    }
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Save to LocalStorage favourites
  const handleSaveFavourite = () => {
    if (!selectedSource || !selectedDest) return;

    let fromId = selectedSource.id;
    let fromName = selectedSource.name;

    // Issue 4.1: when source is live node, save the nearest real stop instead
    if (fromId === 'my_live_location') {
      const nearestReal = routingEngine.isExtendedReady
        ? routingEngine.getNearestPlaces(selectedSource.lat, selectedSource.lng, 10).find((p) => p.node.id !== 'my_live_location')?.node
        : routingEngine.getNearestStops(selectedSource.lat, selectedSource.lng, 2).find((p) => p.node.id !== 'my_live_location')?.node;

      if (nearestReal) {
        fromId = nearestReal.id;
        fromName = nearestReal.name;
      }
    }

    const fav = {
      fromId,
      fromName,
      toId: selectedDest.id,
      toName: selectedDest.name,
      savedAt: new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem('godagraph_favs') || '[]');
      existing.unshift(fav);
      localStorage.setItem('godagraph_favs', JSON.stringify(existing.slice(0, 10)));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: NLP Voice & Quick Intent Input */}
      <ClayCard variant="accent" className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#E0554B] uppercase tracking-wider shrink-0">
          <Sparkles className="w-4 h-4" />
          <span>Local Friend NLP</span>
        </div>
        <div className="relative flex-1 w-full">
          <input
            value={nlpQuery}
            onChange={(e) => setNlpQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNlpSubmit()}
            placeholder='Try: "I am at Dwarka, take me to Panchavati before 6pm with ₹30"'
            className="w-full py-2.5 px-4 pr-12 rounded-full bg-white dark:bg-[#252033] border border-[#E0554B]/20 text-xs font-medium text-[#3B2F4A] dark:text-[#F2EEF9] placeholder:text-[#9E94B3] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#E0554B]"
          />
          <button
            onClick={handleVoiceInput}
            title="Voice input (Web Speech API)"
            className="absolute right-3 top-2 text-[#7E708E] hover:text-[#E0554B] transition-colors"
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>
        <ClayButton
          variant="primary"
          size="sm"
          disabled={nlpLoading}
          onClick={() => handleNlpSubmit()}
          className="shrink-0 w-full sm:w-auto"
        >
          {nlpLoading ? 'Analyzing...' : (nlpButtonText || 'Parse Trip')}
        </ClayButton>
      </ClayCard>

      {/* Main Grid: Left Search & Results | Right Live Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Planner Controls & Route List (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Search Inputs Card */}
          <ClayCard variant="default" className="p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
                Multimodal Journey Search
              </h2>
              <button
                onClick={() => requestLiveLocation(true)}
                className="text-xs font-semibold text-[#E0554B] hover:underline cursor-pointer transition-colors"
              >
                {gpsButtonText}
              </button>
            </div>

            <div className="relative space-y-3">
              {/* Source Input with Autocomplete */}
              <div className="relative">
                <label className="block text-[11px] font-bold text-[#7E708E] dark:text-[#9E94B3] uppercase mb-1">
                  Origin (Source)
                </label>
                <ClayInput
                  value={sourceQuery}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  placeholder="Search stop or landmark (e.g. Dwarka, CBS)..."
                  icon={<Search className="w-4 h-4" />}
                />
                {showSourceDropdown && sourceCompletions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-2xl bg-white dark:bg-[#252033] border border-black/10 dark:border-white/10 shadow-2xl p-2 space-y-1 max-h-72 overflow-y-auto">
                    {sourceCompletions.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          isAutoFollowingRef.current = false;
                          setSelectedSource(item.node);
                          setSourceQuery(item.node.name);
                          setShowSourceDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#FFEFEA] dark:hover:bg-[#341F25] transition-colors flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">{item.node.name}</span>
                          <span className="text-[11px] text-[#7E708E] dark:text-[#9E94B3] ml-2">
                            {item.node.nameMr}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-[#E0554B]">
                          {item.node.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  onClick={handleSwap}
                  className="w-8 h-8 rounded-full bg-white dark:bg-[#1F1B2B] border border-black/10 dark:border-white/10 shadow-md flex items-center justify-center text-[#7E708E] hover:text-[#E0554B] active:scale-90 transition-transform"
                  title="Swap Origin & Destination"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Destination Input with Autocomplete */}
              <div className="relative">
                <label className="block text-[11px] font-bold text-[#7E708E] dark:text-[#9E94B3] uppercase mb-1">
                  Destination
                </label>
                <ClayInput
                  value={destQuery}
                  onChange={(e) => handleDestChange(e.target.value)}
                  placeholder="Where to? (e.g. Ramkund, Sula, Pandavleni)..."
                  icon={<Search className="w-4 h-4" />}
                />
                {showDestDropdown && destCompletions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-2xl bg-white dark:bg-[#252033] border border-black/10 dark:border-white/10 shadow-2xl p-2 space-y-1 max-h-72 overflow-y-auto">
                    {destCompletions.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedDest(item.node);
                          setDestQuery(item.node.name);
                          setShowDestDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#FFEFEA] dark:hover:bg-[#341F25] transition-colors flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">{item.node.name}</span>
                          <span className="text-[11px] text-[#7E708E] dark:text-[#9E94B3] ml-2">
                            {item.node.nameMr}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-[#E0554B]">
                          {item.node.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Environmental & Time Settings Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 dark:border-white/5 text-xs">
              <div className="flex items-center gap-3">
                <ClayToggle
                  checked={isRainy}
                  onChange={setIsRainy}
                  label="Rainy Day Mode"
                  description="Penalizes unsheltered walking"
                />
                <ClayToggle
                  checked={isKumbhFestival}
                  onChange={setIsKumbhFestival}
                  label="Kumbh/Festival"
                  description="Applies Ghat pedestrian masks"
                />
              </div>

              <button
                onClick={() => setShowPreferencesModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/5 font-semibold text-[#5E5170] dark:text-[#A79DBA] hover:text-[#E0554B]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust Weights</span>
              </button>
            </div>
          </ClayCard>

          {/* Local Friend Advice Card */}
          {selectedRoute && (
            <ClayCard variant="sunlit" className="p-4 sm:p-5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D97706]/15 text-[#D97706] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                💡
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#92400E] dark:text-[#FCD34D]">
                  Nashik Local Friend Tip {loadingAdvice && '• Generating...'}
                </h4>
                <p className="text-xs text-[#78350F] dark:text-[#FDE68A] leading-relaxed">
                  {localFriendAdvice ||
                    'Take this route for smooth connectivity. Keep small change handy for Citilinc ticket conductors and auto stands.'}
                </p>
              </div>
            </ClayCard>
          )}

          {/* Action Tools: Share, Save, Print */}
          {routes.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold text-[#7E708E] dark:text-[#9E94B3]">
                {routes.length} Optimal Journeys on Pareto Frontier
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full bg-white dark:bg-[#1F1B2B] border border-black/5 dark:border-white/5 text-[#5E5170] dark:text-[#A79DBA] hover:text-[#E0554B] text-xs flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Copied!' : 'Share'}</span>
                </button>
                <button
                  onClick={handleSaveFavourite}
                  className="p-2 rounded-full bg-white dark:bg-[#1F1B2B] border border-black/5 dark:border-white/5 text-[#5E5170] dark:text-[#A79DBA] hover:text-[#E0554B] text-xs flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{savedSuccess ? 'Saved!' : 'Save'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-full bg-white dark:bg-[#1F1B2B] border border-black/5 dark:border-white/5 text-[#5E5170] dark:text-[#A79DBA] hover:text-[#E0554B] text-xs flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          )}

          {/* Ranked Journey Route Cards */}
          <div className="space-y-4">
            {routes.map((route) => {
              const isSelected = selectedRoute?.id === route.id;
              const isExpanded = expandedRouteId === route.id;

              return (
                <ClayCard
                  key={route.id}
                  variant={isSelected ? 'accent' : 'default'}
                  squishy
                  onClick={() => {
                    setSelectedRoute(route);
                    fetchLocalFriendTip(route);
                  }}
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-[#E0554B] dark:ring-[#FF7A6B]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            route.type === 'fastest'
                              ? 'bg-red-500 text-white'
                              : route.type === 'cheapest'
                              ? 'bg-emerald-500 text-white'
                              : route.type === 'balanced'
                              ? 'bg-[#E0554B] text-white'
                              : 'bg-purple-500 text-white'
                          }`}
                        >
                          {route.title}
                        </span>
                        <span className="text-xs font-semibold text-[#7E708E] dark:text-[#9E94B3]">
                          {route.confidenceScore}% Reliable
                        </span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-display font-bold text-2xl text-[#3B2F4A] dark:text-[#F2EEF9]">
                          {route.totalMinutes} min
                        </span>
                        <span className="text-lg font-bold text-[#E0554B] dark:text-[#FF7A6B]">
                          ₹{route.totalCostInr}
                        </span>
                      </div>
                    </div>

                    {/* Mode Icons Sequence */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-black/5 dark:bg-white/5">
                      {route.legs.map((leg, idx) => (
                        <span
                          key={idx}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                          title={`${leg.mode} (${leg.minutes}m)`}
                        >
                          {leg.mode === 'bus'
                            ? '🚌'
                            : leg.mode === 'auto'
                            ? '🛺'
                            : leg.mode === 'cab'
                            ? '🚕'
                            : '🚶'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Metrics Badges: Walk distance, Transfers, CO2, Calories */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/5 dark:border-white/5 text-[11px] font-medium text-[#7E708E] dark:text-[#9E94B3]">
                    <div className="flex items-center gap-1">
                      <Footprints className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>{route.walkMeters}m walk</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>{route.transfersCount} transfers</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                      <span>-{route.co2SavedKg}kg CO₂</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{route.caloriesBurned} kcal</span>
                    </div>
                  </div>

                  {/* Plan B Lifeline alert if present */}
                  {route.standbyLeg && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{route.standbyLeg.instructions}</span>
                      </div>
                      <span className="font-bold text-amber-700 dark:text-amber-300 shrink-0">
                        ₹{route.standbyLeg.costInr}
                      </span>
                    </div>
                  )}

                  {/* Expand Timeline Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedRouteId(isExpanded ? null : route.id);
                    }}
                    className="mt-3 w-full pt-2 flex items-center justify-center gap-1 text-xs font-bold text-[#E0554B] dark:text-[#FF7A6B] hover:underline cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Step Timeline' : 'View Step-by-Step Directions'}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Expanded Step-by-Step Directions */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 space-y-3">
                      {route.legs.map((leg, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-3 text-xs">
                          <div className="w-6 h-6 rounded-full bg-[#E0554B]/10 dark:bg-white/10 flex items-center justify-center text-xs shrink-0 mt-0.5">
                            {leg.mode === 'bus'
                              ? '🚌'
                              : leg.mode === 'auto'
                              ? '🛺'
                              : leg.mode === 'cab'
                              ? '🚕'
                              : '🚶'}
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <div className="font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">
                              {leg.instructions}
                            </div>
                            <div className="text-[11px] text-[#7E708E] dark:text-[#9E94B3]">
                              {leg.distanceKm.toFixed(1)} km • ~{Math.round(leg.minutes)} min • ₹{leg.costInr}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ClayCard>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Map Container (5 cols) */}
        <div className="lg:col-span-5 sticky top-22">
          <ClayCard variant="default" className="p-3 shadow-2xl overflow-hidden h-[540px] flex flex-col">
            <LiveMap
              selectedRoute={selectedRoute}
              className="w-full flex-1"
              showSimulatedBuses={true}
              userLocation={userLocation}
              showSimulatedVehicles={true}
            />
          </ClayCard>
        </div>
      </div>

      {/* Preferences Slider Modal */}
      <ClayModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        title="Custom Route Preference Weights"
      >
        <div className="space-y-5">
          <p className="text-xs text-[#7E708E] dark:text-[#9E94B3]">
            Adjust the algorithmic objective weights used by the Pravah Pareto selector to tailor your route:
          </p>

          <div>
            <div className="flex justify-between text-xs font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-1">
              <span>Time Priority (Speed)</span>
              <span>{Math.round(weightTime * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={weightTime}
              onChange={(e) => setWeightTime(parseFloat(e.target.value))}
              className="w-full accent-[#E0554B]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-1">
              <span>Cost Priority (Economy)</span>
              <span>{Math.round(weightCost * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={weightCost}
              onChange={(e) => setWeightCost(parseFloat(e.target.value))}
              className="w-full accent-[#E0554B]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-1">
              <span>Comfort Priority (Shelter & AC)</span>
              <span>{Math.round(weightComfort * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={weightComfort}
              onChange={(e) => setWeightComfort(parseFloat(e.target.value))}
              className="w-full accent-[#E0554B]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-[#3B2F4A] dark:text-[#F2EEF9] mb-1">
              <span>Walking Avoidance</span>
              <span>{Math.round(weightWalk * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={weightWalk}
              onChange={(e) => setWeightWalk(parseFloat(e.target.value))}
              className="w-full accent-[#E0554B]"
            />
          </div>

          <div className="pt-2">
            <ClayButton
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => setShowPreferencesModal(false)}
            >
              Apply Weightings
            </ClayButton>
          </div>
        </div>
      </ClayModal>
    </div>
  );
};
