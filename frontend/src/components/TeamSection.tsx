import React, { useState, useRef, useEffect } from 'react';

// Pengimporan berkas dari src/assets/ (Tetap dipertahankan 100%)
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
  { id: '1', name: 'Roni Andripan', role: 'Software Tester', nim: 'G0401241005', cutoutUrl: u1Img },
  { id: '2', name: 'Fajar Dhuha Zafran', role: 'Back-End Developer', nim: 'G0401241009', cutoutUrl: u2Img },
  { id: '3', name: 'Rafif Alfarrel Nugroho', role: 'Project Manager', nim: 'G0401241015', cutoutUrl: u3Img },
  { id: '4', name: 'Azril Ilham Fajrian', role: 'Front-End Developer', nim: 'G0401241020', cutoutUrl: u4Img },
  { id: '5', name: 'Aldo Rafiz Aprilian', role: 'System Analyst', nim: 'G0401241051', cutoutUrl: u5Img },
];

export const TeamSection: React.FC = () => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [animatingChar, setAnimatingChar] = useState<{ memberId: string; charIdx: number } | null>(null);

  // Tipe data timer ramah lingkungan browser (Vite React)
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { animTimeoutsRef.current.forEach(clearTimeout); }, []);

  const clearAnimTimeouts = () => {
    animTimeoutsRef.current.forEach((t) => clearTimeout(t));
    animTimeoutsRef.current = [];
  };

  // Pemicu otomatis saat kursor diarahkan ke kartu nama (Hover Entry)
  const handleMouseEnter = (member: TeamMember) => {
    setFocusedId(member.id);
    clearAnimTimeouts();

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setAnimatingChar(null); return; }
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

  // Pemicu reset saat kursor keluar dari kartu nama (Hover Exit)
  const handleMouseLeave = () => {
    setFocusedId(null);
    setAnimatingChar(null);
    clearAnimTimeouts();
  };

  return (
    <section className="max-w-5xl mx-auto pt-4 pb-16">

      {/* Header Judul di Luar Foto (Theme-Aware Frosted Badge) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 border-b border-white/60 dark:border-slate-800/80 pb-3 gap-2 transition-colors">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-white/90 dark:border-slate-800/80 shadow-md backdrop-blur-md">
          <span className="w-2.5 h-2.5 bg-blue-600 dark:bg-blue-400 rounded-full inline-block animate-pulse" />
          <h2 className="text-xs font-black font-mono tracking-wider text-slate-950 dark:text-slate-100 uppercase">
            Tim Pengembang Proyek Praktikum
          </h2>
          <span className="text-slate-400 font-normal">|</span>
          <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">
            Bioinformatika IPB
          </span>
        </div>

        <span className="text-xs font-mono text-slate-950 dark:text-slate-100 bg-white/90 dark:bg-slate-900/90 px-3 py-1 rounded-xl border border-white/90 dark:border-slate-800/80 font-bold uppercase w-fit shadow-md backdrop-blur-md">
          KONTRIBUTOR MAHASISWA
        </span>
      </div>

      {/* Frame Foto Utama & Layer Interaktif */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-900 dark:bg-slate-950 border border-white/80 dark:border-slate-800/80 min-h-[460px] flex flex-col justify-end transition-all duration-300">

        {/* Layer Foto Utama & Cutout per Anggota */}
        <div className="absolute inset-0 w-full h-full bg-slate-950">
          <img
            src={uchihaImg}
            alt="Tim GenoPath"
            className={`w-full h-full object-contain md:object-cover object-top transition-all duration-500 ease-out ${
              focusedId !== null ? 'blur-md brightness-50 dark:brightness-50 scale-105' : 'blur-0 brightness-100 scale-100'
            }`}
          />

          {/* Layer PNG Transparan Cutout per Anggota (Aktif saat Hover) */}
          {TEAM_DATA.map((member) => (
            <img
              key={member.id}
              src={member.cutoutUrl}
              alt={member.name}
              className={`absolute inset-0 w-full h-full object-contain md:object-cover object-top pointer-events-none transition-all duration-500 ease-out ${
                focusedId === member.id ? 'opacity-100 scale-105 brightness-105 dark:brightness-110' : 'opacity-0 scale-100'
              }`}
            />
          ))}

          {/* Gradasi Gelap di Sisi Bawah Foto */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent pointer-events-none" />
        </div>

        {/* Baris Kartu Anggota (Dynamic Light & Dark Theme Adaptability) */}
        <div className="relative z-20 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {TEAM_DATA.map((member) => {
            const isSelected = focusedId === member.id;
            const isBlurred = focusedId !== null && !isSelected;

            return (
              <div
                key={member.id}
                role="button"
                tabIndex={0}
                aria-label={member.name}
                aria-pressed={isSelected}
                onFocus={() => handleMouseEnter(member)}
                onBlur={handleMouseLeave}
                onClick={() => handleMouseEnter(member)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleMouseEnter(member); }
                  if (event.key === 'Escape') handleMouseLeave();
                }}
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
                {/* NIM (Kontras Siang & Malam) */}
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 block mb-1 font-bold">
                  {member.nim}
                </span>

                {/* Nama Anggota dengan Animasi Gelombang Huruf */}
                <h3 aria-label={member.name} className="font-extrabold text-xs text-slate-950 dark:text-slate-100 leading-snug min-h-[32px] [word-break:keep-all]">
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

                {/* Peran / Role (Kontras Siang & Malam) */}
                <p className="text-[11px] text-blue-700 dark:text-blue-400 font-mono font-bold mt-1">
                  {member.role}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default TeamSection;
