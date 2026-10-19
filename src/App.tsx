import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { PlanPage } from './pages/PlanPage';
import { ExplorePage } from './pages/ExplorePage';
import { LabPage } from './pages/LabPage';
import { FaresPage } from './pages/FaresPage';
import { AboutPage } from './pages/AboutPage';

export default function App() {
  const [currentLang, setCurrentLang] = useState<'en' | 'mr' | 'hi'>('en');
  const [qualityHigh, setQualityHigh] = useState<boolean>(true);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#FFF8F1] dark:bg-[#14121C] text-[#3B2F4A] dark:text-[#F2EEF9] transition-colors duration-200 selection:bg-[#E0554B] selection:text-white">
        {/* Persistent Claymorphism Navigation Header */}
        <Header
          currentLang={currentLang}
          onLangChange={setCurrentLang}
          qualityHigh={qualityHigh}
          onQualityToggle={setQualityHigh}
        />

        {/* Multipage Routing Shell */}
        <main className="flex-1 w-full">
          <Routes>
            <Route
              path="/"
              element={<HomePage currentLang={currentLang} qualityHigh={qualityHigh} />}
            />
            <Route path="/plan" element={<PlanPage currentLang={currentLang} />} />
            <Route path="/explore" element={<ExplorePage currentLang={currentLang} />} />
            <Route path="/lab" element={<LabPage />} />
            <Route path="/fares" element={<FaresPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>

        {/* Persistent Footer with Godavari / Kumbh motif */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}
