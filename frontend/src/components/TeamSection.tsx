import React, { useState, useRef } from 'react';
import { Users, ChevronDown } from 'lucide-react';

import uchihaImg from '../assets/Uchiha.jpg';
import u1Img from '../assets/u1.png';
import u2Img from '../assets/u2.png';
import u3Img from '../assets/u3.png';
import u4Img from '../assets/u4.png';
import u5Img from '../assets/u5.png';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  nim: string;
  cutoutUrl: string;
}

const TEAM_DATA: TeamMember[] = [
  { id: '1', name: 'Roni Andripan', role: 'Software Tester', nim: 'G4401241005', cutoutUrl: u1Img },
  { id: '2', name: 'Fajar Dhuha Zafran', role: 'Back-End Developer', nim: 'G4401241069', cutoutUrl: u2Img },
  { id: '3', name: 'Rafif Alfarrel Nugroho', role: 'Project Manager', nim: 'G4401241015', cutoutUrl: u3Img },
  { id: '4', name: 'Azril Ilham Fajrian', role: 'Front-End Developer', nim: 'G4401241028', cutoutUrl: u4Img },
  { id: '5', name: 'Aldo Rafiz Aprilian', role: 'System Analyst', nim: 'G4401241031', cutoutUrl: u5Img },
];

export const TeamSection: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [animatingChar, setAnimatingChar] = useState<{ memberId: string; charIdx: number } | null>(null);
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAnimTimeouts = () => {
    animTimeoutsRef.current.forEach((t) => clearTimeout(t));
    animTimeoutsRef.current = [];
  };

  const handleMouseEnter = (member: TeamMember) => {
    setFocusedId(member.id);
    clearAnimTimeouts();

    const chars = member.name.split('');
    chars.forEach((_, idx) => {
      const t = setTimeout(() => {
        setAnimatingChar({ memberId: member.id, charIdx: idx });
      }, idx * 60);
      animTimeoutsRef.current.push(t);
    });

    const resetT = setTimeout(() => {
      setAnimatingChar(null);
    }, chars.length * 60 + 200);
    animTimeoutsRef.current.push(resetT);
  };

  const handleMouseLeave = () => {
    setFocusedId(null);
    setAnimatingChar(null);
    clearAnimTimeouts();
  };

  return (
    <section className="w-full space-y-3">
      
      {/* Header Bar Expandable dengan Morphing */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`mx-auto flex items-center justify-between rounded-2xl bg-white/40 dark:bg-slate-900/60 border border-white/60 dark:border-slate-700/60 shadow-xl backdrop-blur-2xl text-left cursor-pointer transition-all duration-300 hover:bg-white/60 dark:hover:bg-slate-900/80 ${
          isExpanded
            ? 'w-full p-4'
            : 'max-w-2xl px-6 py-3.5 border-purple-500/40 shadow-purple-500/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/30">
            <Users className={`transition-all duration-300 ${isExpanded ? 'w-4 h-4' : 'w-5 h-5 text-purple-600 dark:text-purple-300'}`} />
          </div>

          {/* PERBAIKAN: Kontras Warna & Ketebalan Teks Bioinformatika IPB */}
          <h2 className={`font-black font-mono tracking-wider uppercase transition-all duration-300 ${
            isExpanded 
              ? 'text-xs md:text-sm text-slate-950 dark:text-white' 
              : 'text-sm md:text-base text-purple-950 dark:text-purple-200 font-black'
          }`}>
            Tim Pengembang Proyek Praktikum{' '}
            <span className="hidden sm:inline text-purple-700 dark:text-purple-400 font-extrabold">
              | Bioinformatika IPB
            </span>
          </h2>
        </div>

        <ChevronDown
          className={`text-slate-950 dark:text-slate-100 transition-transform duration-300 ${
            isExpanded ? 'w-4 h-4 rotate-180' : 'w-5 h-5 text-purple-600 dark:text-purple-400'
          }`}
        />
      </button>

      {/* Kontainer CSS Grid Transition untuk Animasi Mulus */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-900 dark:bg-slate-950 border border-white/80 dark:border-slate-800/80 min-h-[460px] flex flex-col justify-end transition-all duration-300">
            
            {/* Layer Foto Utama & Cutout per Anggota */}
            <div className="absolute inset-0 w-full h-full bg-slate-950">
              <img
                src={uchihaImg} 
                alt="Tim GenoPath"
                className={`w-full h-full object-cover object-top transition-all duration-500 ease-out ${
                  focusedId !== null ? 'blur-md brightness-50 dark:brightness-50 scale-105' : 'blur-0 brightness-100 scale-100'
                }`}
              />

              {TEAM_DATA.map((member) => (
                <img
                  key={member.id}
                  src={member.cutoutUrl}
                  alt={member.name}
                  className={`absolute inset-0 w-full h-full object-cover object-top pointer-events-none transition-all duration-500 ease-out ${
                    focusedId === member.id ? 'opacity-100 scale-105 brightness-105 dark:brightness-110' : 'opacity-0 scale-100'
                  }`}
                />
              ))}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent pointer-events-none" />
            </div>

            {/* Baris Kartu Anggota */}
            <div className="relative z-20 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {TEAM_DATA.map((member) => {
                const isSelected = focusedId === member.id;
                const isBlurred = focusedId !== null && !isSelected;

                return (
                  <div
                    key={member.id}
                    onMouseEnter={() => handleMouseEnter(member)}
                    onMouseLeave={handleMouseLeave}
                    className={`rounded-2xl p-3 transition-all duration-300 cursor-pointer select-none backdrop-blur-2xl ${
                      isSelected
                        ? 'bg-white/95 dark:bg-slate-900/95 border-2 border-blue-600 dark:border-blue-500 ring-4 ring-blue-500/30 -translate-y-2 scale-105 z-30 shadow-2xl'
                        : isBlurred
                        ? 'bg-white/40 dark:bg-slate-900/40 opacity-40 blur-[1px] scale-95 border border-white/30 dark:border-slate-800'
                        : 'bg-white/85 dark:bg-slate-900/80 hover:bg-white/95 dark:hover:bg-slate-900/95 border border-white/90 dark:border-slate-800/80 hover:border-blue-500/50 hover:-translate-y-1 shadow-lg hover:shadow-2xl'
                    }`}
                  >
                    <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 block mb-1 font-bold">
                      {member.nim}
                    </span>

                    <h3 className="font-extrabold text-xs text-slate-950 dark:text-slate-100 leading-snug min-h-[32px] [word-break:keep-all]">
                      {member.name.split('').map((char, charIdx) => {
                        const isCharAnimating =
                          animatingChar?.memberId === member.id &&
                          animatingChar?.charIdx === charIdx;

                        return (
                          <span
                            key={charIdx}
                            className={`inline-block transition-transform duration-200 ${
                              isCharAnimating
                                ? 'scale-125 text-blue-600 dark:text-blue-400 font-black -translate-y-0.5'
                                : 'scale-100'
                            }`}
                          >
                            {char === ' ' ? '\u00A0' : char}
                          </span>
                        );
                      })}
                    </h3>

                    <p className="text-[11px] text-blue-700 dark:text-blue-400 font-mono font-bold mt-1">
                      {member.role}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default TeamSection;