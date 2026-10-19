import React, { useState } from 'react';
import {
  Coins,
  Sparkles,
  Download,
  Upload,
  Check,
  RefreshCw,
  Bus,
  Car,
  ShieldAlert,
  Plus,
  Trash2,
  Copy,
  Calculator,
  FileSpreadsheet,
  BarChart3,
} from 'lucide-react';
import { ClayCard, ClayButton, ClayInput, ClayModal } from '../components/clay';
import { BUS_ROUTES } from '../data/busRoutes';
import { SHARED_AUTO_CORRIDORS } from '../data/sharedAutoCorridors';
import {
  INITIAL_FARE_SETTINGS,
  getStoredFareSettings,
  saveStoredFareSettings,
} from '../data/fareConfig';
import {
  INITIAL_CAB_PROFILES,
  INITIAL_CAB_OBSERVATIONS,
  getStoredCabProfiles,
  saveStoredCabProfiles,
  getStoredCabObservations,
  saveStoredCabObservations,
  calculateCabFareEstimate,
} from '../data/cabFareDatabase';
import { fitCabRatesOLS, CalibrationResult } from '../dsa/FareCalibration';
import { geminiService, FareEstimateResult } from '../services/gemini';
import {
  FareSettings,
  CabFareProfile,
  CabFareObservation,
  CabProvider,
  CabCategory,
  CabAvailability,
} from '../types';

export const FaresPage: React.FC = () => {
  const [fareSettings, setFareSettings] = useState<FareSettings>(getStoredFareSettings());
  const [activeTab, setActiveTab] = useState<'tariffs' | 'buses' | 'autos' | 'cabs'>('tariffs');

  const [aiProposal, setAiProposal] = useState<FareEstimateResult | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Feature 4: Cab Profiles and Observations
  const [cabProfiles, setCabProfiles] = useState<CabFareProfile[]>(getStoredCabProfiles());
  const [cabObservations, setCabObservations] = useState<CabFareObservation[]>(getStoredCabObservations());

  // Quick estimator inputs
  const [estDistanceKm, setEstDistanceKm] = useState<number>(5.5);
  const [estDurationMin, setEstDurationMin] = useState<number>(18);
  const [estHour, setEstHour] = useState<number>(14);

  // New Observation Form State
  const [newObsProvider, setNewObsProvider] = useState<CabProvider>('Uber');
  const [newObsCategory, setNewObsCategory] = useState<CabCategory>('Auto');
  const [newObsFrom, setNewObsFrom] = useState('');
  const [newObsTo, setNewObsTo] = useState('');
  const [newObsDist, setNewObsDist] = useState(4.0);
  const [newObsDuration, setNewObsDuration] = useState(15);
  const [newObsHour, setNewObsHour] = useState(12);
  const [newObsDayType, setNewObsDayType] = useState<'weekday' | 'weekend'>('weekday');
  const [newObsFare, setNewObsFare] = useState(85);
  const [newObsSurge, setNewObsSurge] = useState(false);

  // Calibration state
  const [selectedCalibGroup, setSelectedCalibGroup] = useState<string>('Uber_Auto');
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);

  const handleSettingChange = (field: keyof FareSettings, val: number) => {
    setFareSettings((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    saveStoredFareSettings(fareSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetDefaults = () => {
    setFareSettings(INITIAL_FARE_SETTINGS);
    saveStoredFareSettings(INITIAL_FARE_SETTINGS);
  };

  const handleExportJson = () => {
    const data = {
      fareSettings,
      cabProfiles,
      cabObservations,
      routesCount: BUS_ROUTES.length,
      corridorsCount: SHARED_AUTO_CORRIDORS.length,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `godagraph_tariffs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.fareSettings) {
          setFareSettings(parsed.fareSettings);
          saveStoredFareSettings(parsed.fareSettings);
        }
        if (parsed.cabProfiles && Array.isArray(parsed.cabProfiles)) {
          setCabProfiles(parsed.cabProfiles);
          saveStoredCabProfiles(parsed.cabProfiles);
        }
        if (parsed.cabObservations && Array.isArray(parsed.cabObservations)) {
          setCabObservations(parsed.cabObservations);
          saveStoredCabObservations(parsed.cabObservations);
        }
        alert('Tariffs & cab database imported successfully!');
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  // Profile actions
  const handleProfileFieldChange = (id: string, field: keyof CabFareProfile, value: any) => {
    const updated = cabProfiles.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    setCabProfiles(updated);
    saveStoredCabProfiles(updated);
  };

  const handleDuplicateProfile = (profile: CabFareProfile) => {
    const newProfile: CabFareProfile = {
      ...profile,
      id: `${profile.id}_copy_${Date.now()}`,
      category: profile.category,
      notes: `${profile.notes} (Copy)`,
    };
    const updated = [...cabProfiles, newProfile];
    setCabProfiles(updated);
    saveStoredCabProfiles(updated);
  };

  const handleDeleteProfile = (id: string) => {
    if (cabProfiles.length <= 1) return;
    const updated = cabProfiles.filter((p) => p.id !== id);
    setCabProfiles(updated);
    saveStoredCabProfiles(updated);
  };

  const handleResetCabProfiles = () => {
    setCabProfiles(INITIAL_CAB_PROFILES);
    saveStoredCabProfiles(INITIAL_CAB_PROFILES);
  };

  // Observation actions
  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObsFrom.trim() || !newObsTo.trim()) return;

    const newObs: CabFareObservation = {
      id: `obs_${Date.now()}`,
      provider: newObsProvider,
      category: newObsCategory,
      fromName: newObsFrom.trim(),
      toName: newObsTo.trim(),
      distanceKm: newObsDist,
      durationMin: newObsDuration,
      hourOfDay: newObsHour,
      dayType: newObsDayType,
      quotedFare: newObsFare,
      surgeSeen: newObsSurge,
      observedAt: new Date().toISOString(),
    };

    const updated = [newObs, ...cabObservations];
    setCabObservations(updated);
    saveStoredCabObservations(updated);
    setNewObsFrom('');
    setNewObsTo('');
  };

  const handleDeleteObservation = (id: string) => {
    const updated = cabObservations.filter((o) => o.id !== id);
    setCabObservations(updated);
    saveStoredCabObservations(updated);
  };

  const handleExportObservationsCsv = () => {
    const headers = [
      'id',
      'provider',
      'category',
      'fromName',
      'toName',
      'distanceKm',
      'durationMin',
      'hourOfDay',
      'dayType',
      'quotedFare',
      'surgeSeen',
      'observedAt',
    ];
    const rows = cabObservations.map((o) => [
      o.id,
      o.provider,
      o.category,
      `"${o.fromName.replace(/"/g, '""')}"`,
      `"${o.toName.replace(/"/g, '""')}"`,
      o.distanceKm,
      o.durationMin,
      o.hourOfDay,
      o.dayType,
      o.quotedFare,
      o.surgeSeen,
      o.observedAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `godagraph_cab_observations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportObservationsCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const imported: CabFareObservation[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(',');
          if (parts.length >= 10) {
            imported.push({
              id: parts[0] || `csv_${Date.now()}_${i}`,
              provider: (parts[1] as any) || 'Uber',
              category: (parts[2] as any) || 'Auto',
              fromName: parts[3]?.replace(/^"|"$/g, '') || '',
              toName: parts[4]?.replace(/^"|"$/g, '') || '',
              distanceKm: parseFloat(parts[5]) || 3.0,
              durationMin: parseFloat(parts[6]) || 12,
              hourOfDay: parseInt(parts[7], 10) || 12,
              dayType: (parts[8] as any) || 'weekday',
              quotedFare: parseFloat(parts[9]) || 50,
              surgeSeen: parts[10] === 'true',
              observedAt: parts[11] || new Date().toISOString(),
            });
          }
        }
        if (imported.length > 0) {
          const updated = [...imported, ...cabObservations];
          setCabObservations(updated);
          saveStoredCabObservations(updated);
          alert(`Successfully imported ${imported.length} observations!`);
        }
      } catch (err) {
        alert('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  // Calibration OLS calculation
  const handleRunCalibration = () => {
    setCalibrationError(null);
    setCalibrationResult(null);

    const [provider, category] = selectedCalibGroup.split('_');
    const matching = cabObservations.filter(
      (o) => o.provider === provider && o.category === category
    );

    if (matching.length < 5) {
      setCalibrationError(
        `Insufficient observations for ${provider} ${category}: minimum 5 required, found ${matching.length}. Add more screenshots in the table above.`
      );
      return;
    }

    try {
      const res = fitCabRatesOLS(matching);
      setCalibrationResult(res);
    } catch (err: any) {
      setCalibrationError(err?.message || 'Calibration calculation failed');
    }
  };

  const handleApplyCalibration = () => {
    if (!calibrationResult) return;
    const [provider, category] = selectedCalibGroup.split('_');

    const updated = cabProfiles.map((p) => {
      if (p.provider === provider && p.category === category) {
        return {
          ...p,
          baseFare: Math.max(10, Math.round(calibrationResult.intercept)),
          perKm: Number(Math.max(5, calibrationResult.a).toFixed(2)),
          perMin: Number(Math.max(0.5, calibrationResult.b).toFixed(2)),
          source: 'user_screenshot' as const,
          lastVerified: new Date().toISOString().slice(0, 10),
          notes: `Fitted from ${calibrationResult.n} user screenshots (MAE ₹${calibrationResult.mae.toFixed(1)}, MAPE ${calibrationResult.mape.toFixed(1)}%).`,
        };
      }
      return p;
    });

    setCabProfiles(updated);
    saveStoredCabProfiles(updated);
    alert(`Applied fitted rates to ${provider} ${category}!`);
  };

  // Gemini Fare Estimator
  const handleConsultGemini = async () => {
    setLoadingAi(true);
    try {
      const res = await geminiService.getFareEstimates();
      setAiProposal(res);
      setShowProposalModal(true);
    } finally {
      setLoadingAi(false);
    }
  };

  const applyAiProposal = () => {
    if (!aiProposal) return;
    const updated: FareSettings = {
      ...fareSettings,
      busBaseFare: aiProposal.busBaseFare,
      busPerStage: aiProposal.busPerStage,
      autoMeterBase: aiProposal.autoMeterBase,
      autoMeterPerKm: aiProposal.autoMeterPerKm,
      sharedAutoBase: aiProposal.sharedAutoBase,
      cabBase: aiProposal.cabBase,
      cabPerKm: aiProposal.cabPerKm,
      cabPerMin: aiProposal.cabPerMin,
    };
    setFareSettings(updated);
    saveStoredFareSettings(updated);
    setShowProposalModal(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-[#E0554B]/10 text-[#E0554B] mb-2">
            <Coins className="w-3.5 h-3.5" />
            <span>Configurable Tariffs & Schedules</span>
          </div>
          <h1 className="font-display font-light text-3xl sm:text-4xl text-[#3B2F4A] dark:text-[#F2EEF9]">
            Nashik Fare & Timetable Explorer
          </h1>
          <p className="text-xs sm:text-sm text-[#7E708E] dark:text-[#9E94B3]">
            Inspect Citilinc bus headways, seat auto pricing, and customize RTO tariffs with Gemini updates.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <ClayButton
            variant="mint"
            size="sm"
            disabled={loadingAi}
            onClick={handleConsultGemini}
            icon={<Sparkles className="w-3.5 h-3.5" />}
          >
            {loadingAi ? 'Querying...' : 'Gemini Tariff Check'}
          </ClayButton>

          <ClayButton
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export JSON
          </ClayButton>

          <label className="cursor-pointer">
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            <span className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold bg-white dark:bg-[#282336] border border-black/5 dark:border-white/10 text-[#3B2F4A] dark:text-[#F2EEF9] gap-1.5 hover:bg-neutral-50 shadow-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </span>
          </label>
        </div>
      </div>

      {/* Tabs with exact button classes */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('tariffs')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tariffs'
              ? 'bg-[#E0554B] text-white shadow-xs'
              : 'bg-black/5 dark:bg-white/5 text-[#7E708E]'
          }`}
        >
          Tariff Constants Editor
        </button>
        <button
          onClick={() => setActiveTab('buses')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'buses'
              ? 'bg-[#E0554B] text-white shadow-xs'
              : 'bg-black/5 dark:bg-white/5 text-[#7E708E]'
          }`}
        >
          Citilinc Bus Timetables (12 Routes)
        </button>
        <button
          onClick={() => setActiveTab('autos')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'autos'
              ? 'bg-[#E0554B] text-white shadow-xs'
              : 'bg-black/5 dark:bg-white/5 text-[#7E708E]'
          }`}
        >
          Shared Auto Seat Rates (8 Corridors)
        </button>
        <button
          onClick={() => setActiveTab('cabs')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'cabs'
              ? 'bg-[#E0554B] text-white shadow-xs'
              : 'bg-black/5 dark:bg-white/5 text-[#7E708E]'
          }`}
        >
          App Cabs: Uber / Ola Database
        </button>
      </div>

      {/* ================= TAB 1: TARIFFS ================= */}
      {activeTab === 'tariffs' && (
        <ClayCard variant="default" className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
              Mode Fare Formulations
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetDefaults}
                className="text-xs font-semibold text-[#7E708E] hover:text-[#E0554B] cursor-pointer"
              >
                Reset to Defaults
              </button>
              <ClayButton variant="primary" size="sm" onClick={handleSave}>
                {saveSuccess ? 'Saved ✓' : 'Save Tariffs'}
              </ClayButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Citilinc Bus Section */}
            <div className="p-5 rounded-2xl bg-black/3 dark:bg-white/5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E0554B] uppercase">
                <Bus className="w-4 h-4" />
                <span>Citilinc City Bus</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Base Fare (₹ First Stage)
                </label>
                <input
                  type="number"
                  value={fareSettings.busBaseFare}
                  onChange={(e) => handleSettingChange('busBaseFare', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Incremental Stage Fare (₹ / km)
                </label>
                <input
                  type="number"
                  value={fareSettings.busPerStage}
                  onChange={(e) => handleSettingChange('busPerStage', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
            </div>

            {/* Auto Rickshaw Section */}
            <div className="p-5 rounded-2xl bg-black/3 dark:bg-white/5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F59E0B] uppercase">
                <Car className="w-4 h-4" />
                <span>Auto Rickshaw (RTO Metered)</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Meter Base Fare (₹ First 1.5 km)
                </label>
                <input
                  type="number"
                  value={fareSettings.autoMeterBase}
                  onChange={(e) => handleSettingChange('autoMeterBase', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Subsequent Rate (₹ / km)
                </label>
                <input
                  type="number"
                  value={fareSettings.autoMeterPerKm}
                  onChange={(e) => handleSettingChange('autoMeterPerKm', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Shared Auto Base Seat Rate (₹)
                </label>
                <input
                  type="number"
                  value={fareSettings.sharedAutoBase}
                  onChange={(e) => handleSettingChange('sharedAutoBase', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
            </div>

            {/* Cab Section */}
            <div className="p-5 rounded-2xl bg-black/3 dark:bg-white/5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#8B5CF6] uppercase">
                <Car className="w-4 h-4" />
                <span>App Cab (Uber / Ola)</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Base Booking Fare (₹)
                </label>
                <input
                  type="number"
                  value={fareSettings.cabBase}
                  onChange={(e) => handleSettingChange('cabBase', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Distance Rate (₹ / km)
                </label>
                <input
                  type="number"
                  value={fareSettings.cabPerKm}
                  onChange={(e) => handleSettingChange('cabPerKm', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] mb-1">
                  Trip Time Rate (₹ / min)
                </label>
                <input
                  type="number"
                  value={fareSettings.cabPerMin}
                  onChange={(e) => handleSettingChange('cabPerMin', parseFloat(e.target.value) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </ClayCard>
      )}

      {/* ================= TAB 2: BUSES ================= */}
      {activeTab === 'buses' && (
        <ClayCard variant="default" className="p-6 space-y-4 overflow-x-auto">
          <h3 className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
            Nashik Citilinc City Bus Routes
          </h3>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-[#7E708E] uppercase tracking-wider">
                <th className="py-2.5 px-3">Route #</th>
                <th className="py-2.5 px-3">Route Name</th>
                <th className="py-2.5 px-3">Headway</th>
                <th className="py-2.5 px-3">First Bus</th>
                <th className="py-2.5 px-3">Last Bus</th>
                <th className="py-2.5 px-3">Total Stops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 font-medium">
              {BUS_ROUTES.map((route) => (
                <tr key={route.id} className="hover:bg-black/2 dark:hover:bg-white/2">
                  <td className="py-3 px-3 font-bold text-[#E0554B]">{route.number}</td>
                  <td className="py-3 px-3 font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">
                    {route.name}
                  </td>
                  <td className="py-3 px-3 text-[#10B981] font-semibold">{route.headwayMinutes} min</td>
                  <td className="py-3 px-3">{route.firstBus}</td>
                  <td className="py-3 px-3">{route.lastBus}</td>
                  <td className="py-3 px-3 font-mono">{route.stops.length} stops</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      )}

      {/* ================= TAB 3: AUTOS ================= */}
      {activeTab === 'autos' && (
        <ClayCard variant="default" className="p-6 space-y-4 overflow-x-auto">
          <h3 className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
            Major Seat Auto Corridors
          </h3>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-[#7E708E] uppercase tracking-wider">
                <th className="py-2.5 px-3">Corridor</th>
                <th className="py-2.5 px-3">Fixed Per-Seat Fare</th>
                <th className="py-2.5 px-3">Frequency</th>
                <th className="py-2.5 px-3">Intermediate Stops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 font-medium">
              {SHARED_AUTO_CORRIDORS.map((c) => (
                <tr key={c.id} className="hover:bg-black/2 dark:hover:bg-white/2">
                  <td className="py-3 px-3 font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">{c.name}</td>
                  <td className="py-3 px-3 font-bold text-[#F59E0B]">₹{c.perSeatFare}</td>
                  <td className="py-3 px-3 text-emerald-600 font-semibold">Every {c.frequencyMinutes} min</td>
                  <td className="py-3 px-3 text-[#7E708E]">{c.stops.join(' → ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      )}

      {/* ================= TAB 4: APP CABS (UBER / OLA) ================= */}
      {activeTab === 'cabs' && (
        <div className="space-y-8">
          {/* Rate Card Table */}
          <ClayCard variant="default" className="p-6 space-y-4 overflow-x-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
                  Uber & Ola Tariff Rate Cards (Editable)
                </h3>
                <p className="text-xs text-[#7E708E] dark:text-[#9E94B3]">
                  Rate parameters per provider and vehicle category in Nashik.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetCabProfiles}
                  className="text-xs font-semibold text-[#7E708E] hover:text-[#E0554B] cursor-pointer"
                >
                  Reset Seed Profiles
                </button>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-[#7E708E] uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-2">Provider</th>
                  <th className="py-2.5 px-2">Category</th>
                  <th className="py-2.5 px-2">Base (₹)</th>
                  <th className="py-2.5 px-2">Inc. Km</th>
                  <th className="py-2.5 px-2">₹/Km</th>
                  <th className="py-2.5 px-2">₹/Min</th>
                  <th className="py-2.5 px-2">Min Fare</th>
                  <th className="py-2.5 px-2">Booking Fee</th>
                  <th className="py-2.5 px-2">Night %</th>
                  <th className="py-2.5 px-2">Peak Range</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Source</th>
                  <th className="py-2.5 px-2">Verified</th>
                  <th className="py-2.5 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 font-medium">
                {cabProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-black/2 dark:hover:bg-white/2">
                    <td className="py-2.5 px-2 font-bold text-[#8B5CF6]">{p.provider}</td>
                    <td className="py-2.5 px-2 font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">
                      {p.category}
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        value={p.baseFare}
                        onChange={(e) =>
                          handleProfileFieldChange(p.id, 'baseFare', parseFloat(e.target.value) || 0)
                        }
                        className="w-16 py-1 px-1.5 rounded-lg bg-black/5 dark:bg-white/5 font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="0.5"
                        value={p.includedKm}
                        onChange={(e) =>
                          handleProfileFieldChange(p.id, 'includedKm', parseFloat(e.target.value) || 0)
                        }
                        className="w-14 py-1 px-1.5 rounded-lg bg-black/5 dark:bg-white/5"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="0.5"
                        value={p.perKm}
                        onChange={(e) =>
                          handleProfileFieldChange(p.id, 'perKm', parseFloat(e.target.value) || 0)
                        }
                        className="w-16 py-1 px-1.5 rounded-lg bg-black/5 dark:bg-white/5 font-bold text-[#E0554B]"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="0.1"
                        value={p.perMin}
                        onChange={(e) =>
                          handleProfileFieldChange(p.id, 'perMin', parseFloat(e.target.value) || 0)
                        }
                        className="w-14 py-1 px-1.5 rounded-lg bg-black/5 dark:bg-white/5"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        value={p.minFare}
                        onChange={(e) =>
                          handleProfileFieldChange(p.id, 'minFare', parseFloat(e.target.value) || 0)
                        }
                        className="w-16 py-1 px-1.5 rounded-lg bg-black/5 dark:bg-white/5"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        value={p.bookingFee}
                        onChange={(e) =>
                          handleProfileFieldChange(p.id, 'bookingFee', parseFloat(e.target.value) || 0)
                        }
                        className="w-14 py-1 px-1.5 rounded-lg bg-black/5 dark:bg-white/5"
                      />
                    </td>
                    <td className="py-2.5 px-2">{p.nightSurchargePct}%</td>
                    <td className="py-2.5 px-2 font-mono text-[11px]">
                      {p.peakMultiplierMin}x - {p.peakMultiplierMax}x
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          p.availabilityInNashik === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : p.availabilityInNashik === 'unverified'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-neutral-500/10 text-neutral-500'
                        }`}
                      >
                        {p.availabilityInNashik}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600">
                        {p.source}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-[11px] text-[#7E708E]">{p.lastVerified || 'Not verified'}</td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDuplicateProfile(p)}
                          title="Duplicate"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#7E708E] hover:text-[#3B2F4A] cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(p.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ClayCard>

          {/* Quick Fare Estimator */}
          <ClayCard variant="accent" className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#E0554B] uppercase tracking-wider">
              <Calculator className="w-4 h-4" />
              <span>Quick Fare Estimator</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] dark:text-[#9E94B3] mb-1">
                  Trip Distance (km)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={estDistanceKm}
                  onChange={(e) => setEstDistanceKm(parseFloat(e.target.value) || 0.1)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 dark:border-white/10 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] dark:text-[#9E94B3] mb-1">
                  Trip Duration (minutes)
                </label>
                <input
                  type="number"
                  value={estDurationMin}
                  onChange={(e) => setEstDurationMin(parseFloat(e.target.value) || 1)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 dark:border-white/10 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7E708E] dark:text-[#9E94B3] mb-1">
                  Hour of Day (0-23)
                </label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={estHour}
                  onChange={(e) => setEstHour(parseInt(e.target.value, 10) || 0)}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 dark:border-white/10 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {cabProfiles.map((p) => {
                const est = calculateCabFareEstimate(p, estDistanceKm, estDurationMin, estHour);
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#252033]/80 border border-black/5 dark:border-white/10 space-y-1 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#7E708E]">
                      <span>{p.provider}</span>
                      <span className="text-[10px] text-[#8B5CF6] uppercase">{p.category}</span>
                    </div>
                    <div className="text-base font-extrabold text-[#3B2F4A] dark:text-[#F2EEF9]">
                      ₹{est.low} - ₹{est.high}
                    </div>
                    <div className="text-[10px] text-[#7E708E] flex items-center justify-between">
                      <span>Base ₹{est.baseCalc}</span>
                      {est.isNight && <span className="text-purple-600 font-bold">Night +{p.nightSurchargePct}%</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ClayCard>

          {/* Observations Table */}
          <ClayCard variant="default" className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-xl text-[#3B2F4A] dark:text-[#F2EEF9]">
                  Real App Screenshot Observations ({cabObservations.length})
                </h3>
                <p className="text-xs text-[#7E708E] dark:text-[#9E94B3]">
                  Recorded fare quotes from Uber and Ola apps in Nashik.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ClayButton
                  variant="secondary"
                  size="sm"
                  onClick={handleExportObservationsCsv}
                  icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                >
                  Export CSV
                </ClayButton>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportObservationsCsv}
                    className="hidden"
                  />
                  <span className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#282336] border border-black/5 dark:border-white/10 text-[#3B2F4A] dark:text-[#F2EEF9] gap-1 hover:bg-neutral-50 shadow-xs cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Import CSV</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Add Observation Form */}
            <form
              onSubmit={handleAddObservation}
              className="p-4 rounded-2xl bg-black/3 dark:bg-white/5 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#7E708E] mb-1">Provider</label>
                <select
                  value={newObsProvider}
                  onChange={(e) => setNewObsProvider(e.target.value as any)}
                  className="w-full py-1.5 px-2 rounded-xl bg-white dark:bg-[#252033] border border-black/10"
                >
                  <option value="Uber">Uber</option>
                  <option value="Ola">Ola</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#7E708E] mb-1">Category</label>
                <select
                  value={newObsCategory}
                  onChange={(e) => setNewObsCategory(e.target.value as any)}
                  className="w-full py-1.5 px-2 rounded-xl bg-white dark:bg-[#252033] border border-black/10"
                >
                  <option value="Auto">Auto</option>
                  <option value="Mini/Go">Mini/Go</option>
                  <option value="Sedan/Prime">Sedan/Prime</option>
                  <option value="SUV/XL">SUV/XL</option>
                  <option value="Bike">Bike</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#7E708E] mb-1">From Origin</label>
                <input
                  type="text"
                  placeholder="e.g. CBS"
                  value={newObsFrom}
                  onChange={(e) => setNewObsFrom(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-xl bg-white dark:bg-[#252033] border border-black/10"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#7E708E] mb-1">To Dest</label>
                <input
                  type="text"
                  placeholder="e.g. Ramkund"
                  value={newObsTo}
                  onChange={(e) => setNewObsTo(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-xl bg-white dark:bg-[#252033] border border-black/10"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#7E708E] mb-1">Quoted Fare (₹)</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={newObsFare}
                    onChange={(e) => setNewObsFare(parseFloat(e.target.value) || 0)}
                    className="w-full py-1.5 px-2 rounded-xl bg-white dark:bg-[#252033] border border-black/10 font-bold text-[#E0554B]"
                  />
                  <ClayButton variant="primary" size="sm" type="submit">
                    Add
                  </ClayButton>
                </div>
              </div>
            </form>

            {/* Observations Table */}
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[#7E708E] uppercase tracking-wider text-[11px]">
                    <th className="py-2 px-2">Provider</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2">Trip</th>
                    <th className="py-2 px-2">Km</th>
                    <th className="py-2 px-2">Min</th>
                    <th className="py-2 px-2">Hour</th>
                    <th className="py-2 px-2">Quoted Fare</th>
                    <th className="py-2 px-2">Surge</th>
                    <th className="py-2 px-2 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 font-medium">
                  {cabObservations.map((o) => (
                    <tr key={o.id} className="hover:bg-black/2 dark:hover:bg-white/2">
                      <td className="py-2 px-2 font-bold text-[#8B5CF6]">{o.provider}</td>
                      <td className="py-2 px-2 font-semibold">{o.category}</td>
                      <td className="py-2 px-2 text-[#3B2F4A] dark:text-[#F2EEF9]">
                        {o.fromName} → {o.toName}
                      </td>
                      <td className="py-2 px-2">{o.distanceKm} km</td>
                      <td className="py-2 px-2">{o.durationMin}m</td>
                      <td className="py-2 px-2">{o.hourOfDay}:00</td>
                      <td className="py-2 px-2 font-bold text-[#E0554B]">₹{o.quotedFare}</td>
                      <td className="py-2 px-2">
                        {o.surgeSeen ? (
                          <span className="text-amber-600 font-bold">Surge</span>
                        ) : (
                          <span className="text-emerald-600">Standard</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleDeleteObservation(o.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ClayCard>

          {/* Calibration Card (OLS via Normal Equations) */}
          <ClayCard variant="sunlit" className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#92400E] uppercase tracking-wider">
              <BarChart3 className="w-4 h-4" />
              <span>OLS Rate Calibration (Gaussian Elimination)</span>
            </div>
            <p className="text-xs text-[#78350F] dark:text-[#FDE68A] leading-relaxed">
              Fits the linear rate equation: <code>Fare ≈ intercept + a * km + b * min</code> from recorded app observations. Requires at least 5 observations per category.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedCalibGroup}
                onChange={(e) => setSelectedCalibGroup(e.target.value)}
                className="py-2 px-3 rounded-xl bg-white dark:bg-[#252033] border border-black/10 text-xs font-bold"
              >
                <option value="Uber_Auto">Uber Auto</option>
                <option value="Uber_Mini/Go">Uber Go</option>
                <option value="Uber_Sedan/Prime">Uber Premier</option>
                <option value="Ola_Auto">Ola Auto</option>
                <option value="Ola_Mini/Go">Ola Mini</option>
                <option value="Ola_Sedan/Prime">Ola Prime</option>
              </select>

              <ClayButton
                variant="primary"
                size="sm"
                onClick={handleRunCalibration}
                icon={<BarChart3 className="w-3.5 h-3.5" />}
              >
                Fit Rates From Observations
              </ClayButton>
            </div>

            {calibrationError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300">
                {calibrationError}
              </div>
            )}

            {calibrationResult && (
              <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#252033]/90 border border-black/10 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">
                  <span>Fitted Model (n = {calibrationResult.n})</span>
                  <span className="text-emerald-600">
                    MAE: ₹{calibrationResult.mae.toFixed(1)} | MAPE: {calibrationResult.mape.toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                    <span className="text-[#7E708E] block text-[10px]">Intercept (Base)</span>
                    <span className="font-extrabold text-sm text-[#E0554B]">
                      ₹{calibrationResult.intercept.toFixed(1)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                    <span className="text-[#7E708E] block text-[10px]">Rate per Km (a)</span>
                    <span className="font-extrabold text-sm text-[#8B5CF6]">
                      ₹{calibrationResult.a.toFixed(2)}/km
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                    <span className="text-[#7E708E] block text-[10px]">Rate per Min (b)</span>
                    <span className="font-extrabold text-sm text-[#F59E0B]">
                      ₹{calibrationResult.b.toFixed(2)}/min
                    </span>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <ClayButton variant="mint" size="sm" onClick={handleApplyCalibration}>
                    Apply Fitted Rates to Profile
                  </ClayButton>
                </div>
              </div>
            )}
          </ClayCard>

          {/* Project Disclaimer */}
          <div className="p-3.5 rounded-2xl bg-black/4 dark:bg-white/5 text-center text-xs text-[#7E708E] dark:text-[#9E94B3]">
            Independent student project, not affiliated with Uber or Ola. Estimates only.
          </div>
        </div>
      )}

      {/* Gemini Tariff Proposal Approval Modal */}
      <ClayModal
        isOpen={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        title="Gemini AI Fare Proposal"
      >
        {aiProposal && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-2xl bg-[#E0554B]/10 text-[#E0554B] flex items-center justify-between">
              <span className="font-bold">Confidence: {Math.round(aiProposal.confidence * 100)}%</span>
              <span className="text-[10px] uppercase font-bold">AI Estimated</span>
            </div>
            <p className="text-[#7E708E] dark:text-[#9E94B3] leading-relaxed">{aiProposal.notes}</p>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-black/4 dark:bg-white/5 font-medium">
              <div>Bus Base: ₹{aiProposal.busBaseFare}</div>
              <div>Bus Per-Stage: ₹{aiProposal.busPerStage}</div>
              <div>Auto Meter Base: ₹{aiProposal.autoMeterBase}</div>
              <div>Auto Per-Km: ₹{aiProposal.autoMeterPerKm}</div>
              <div>Shared Auto Base: ₹{aiProposal.sharedAutoBase}</div>
              <div>Cab Base: ₹{aiProposal.cabBase}</div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <ClayButton variant="secondary" size="sm" onClick={() => setShowProposalModal(false)}>
                Reject
              </ClayButton>
              <ClayButton variant="primary" size="sm" onClick={applyAiProposal}>
                Accept & Update Fare Table
              </ClayButton>
            </div>
          </div>
        )}
      </ClayModal>
    </div>
  );
};
