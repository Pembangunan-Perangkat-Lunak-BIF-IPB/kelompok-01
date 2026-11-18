import React, { useState } from 'react';

// Pengimporan berkas dari src/assets/
import uchihaImg from '../assets/teampic.png';
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
  originX: string; // Titik pusat posisi masing-masing orang di foto
}

const TEAM_DATA: TeamMember[] = [
  { id: '1', name: 'Roni Andripan', role: 'Software Tester', nim: 'G0401241005', cutoutUrl: u1Img, originX: '14%' },
  { id: '2', name: 'Fajar Dhuha Zafran', role: 'Back-End Developer', nim: 'G0401241009', cutoutUrl: u2Img, originX: '32%' },
  { id: '3', name: 'Rafif Alfarrel Nugroho', role: 'Project Manager', nim: 'G0401241015', cutoutUrl: u3Img, originX: '50%' },
  { id: '4', name: 'Azril Ilham Fajrian', role: 'Front-End Developer', nim: 'G0401241020', cutoutUrl: u4Img, originX: '68%' },
  { id: '5', name: 'Aldo Rafiz Aprilian', role: 'System Analyst', nim: 'G0401241051', cutoutUrl: u5Img, originX: '86%' },
];

export const TeamSection: React.FC = () => {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const handleActivate = (member: TeamMember) => {
    setFocusedId(member.id);
  };

  const handleDeactivate = () => {
    setFocusedId(null);
  };

  return (
    <section className="w-full max-w-6xl mx-auto pt-4 pb-16 px-4 sm:px-6">
      <style>{`
        @property --snake-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        @keyframes snake-glide {
          0% {
            --snake-angle: 0deg;
          }
          100% {
            --snake-angle: 360deg;
          }
        }

        /* Kurva akselerasi & perlambatan halus (Silky Glide) */
        .silky-glide {
          transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* Layer 1: Kepala cahaya lebih tebal & berpendar dengan aksen botanical lime & glacier blue */
        .snake-glow-head {
          filter: brightness(0) invert(1)
            drop-shadow(0 0 1.2px rgba(255, 255, 255, 1))
            drop-shadow(0 0 4px rgba(217, 232, 184, 0.92))
            drop-shadow(0 0 9px rgba(139, 196, 238, 0.72));
          -webkit-mask-image: conic-gradient(
            from var(--snake-angle) at var(--origin-x, 50%) 45%,
            transparent 0deg,
            transparent 230deg,
            rgba(255, 255, 255, 0.08) 265deg,
            rgba(255, 255, 255, 0.35) 295deg,
            rgba(255, 255, 255, 0.85) 318deg,
            #ffffff 330deg,
            rgba(255, 255, 255, 0.4) 336deg,
            transparent 342deg,
            transparent 360deg
          );
          mask-image: conic-gradient(
            from var(--snake-angle) at var(--origin-x, 50%) 45%,
            transparent 0deg,
            transparent 230deg,
            rgba(255, 255, 255, 0.08) 265deg,
            rgba(255, 255, 255, 0.35) 295deg,
            rgba(255, 255, 255, 0.85) 318deg,
            #ffffff 330deg,
            rgba(255, 255, 255, 0.4) 336deg,
            transparent 342deg,
            transparent 360deg
          );
          animation: snake-glide 2.8s linear infinite;
          will-change: transform, opacity;
        }

        /* Layer 2: Ekor panjang yang menipis halus mengikuti di belakang kepala */
        .snake-glow-tail {
          filter: brightness(0) invert(1)
            drop-shadow(0 0 0.8px rgba(217, 232, 184, 0.85))
            drop-shadow(0 0 2px rgba(139, 196, 238, 0.45));
          -webkit-mask-image: conic-gradient(
            from var(--snake-angle) at var(--origin-x, 50%) 45%,
            transparent 0deg,
            transparent 150deg,
            rgba(255, 255, 255, 0.05) 185deg,
            rgba(255, 255, 255, 0.25) 235deg,
            rgba(255, 255, 255, 0.65) 290deg,
            #ffffff 328deg,
            transparent 340deg,
            transparent 360deg
          );
          mask-image: conic-gradient(
            from var(--snake-angle) at var(--origin-x, 50%) 45%,
            transparent 0deg,
            transparent 150deg,
            rgba(255, 255, 255, 0.05) 185deg,
            rgba(255, 255, 255, 0.25) 235deg,
            rgba(255, 255, 255, 0.65) 290deg,
            #ffffff 328deg,
            transparent 340deg,
            transparent 360deg
          );
          animation: snake-glide 2.8s linear infinite;
          will-change: transform, opacity;
        }
      `}</style>

      {/* Header Judul di Luar Foto */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 border-b border-[var(--gp-border)] pb-3 gap-2 transition-colors">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#fcfcf8]/95 dark:bg-[#192b30]/95 border border-[var(--gp-border)] shadow-sm backdrop-blur-md">
          <span className="w-2.5 h-2.5 bg-[var(--gp-botanical)] rounded-full inline-block animate-pulse" />
          <h2 className="text-xs font-black font-mono tracking-wider text-[var(--gp-text)] uppercase">
            Tim Pengembang Proyek Praktikum
          </h2>
          <span className="text-[var(--gp-border)] font-normal">|</span>
          <span className="text-xs text-[var(--gp-muted)] font-bold">
            Bioinformatika IPB
          </span>
        </div>

        <span className="text-xs font-mono text-[var(--gp-botanical)] bg-[#fcfcf8]/95 dark:bg-[#192b30]/95 px-3 py-1 rounded-xl border border-[var(--gp-border)] font-bold uppercase w-fit shadow-sm backdrop-blur-md">
          KONTRIBUTOR MAHASISWA
        </span>
      </div>

      {/* Frame Foto Utama (Mengikuti Deep Marine Slate-Teal Hero GenoPath) */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-[var(--gp-rail)] border border-[var(--gp-border)] transition-colors duration-300">

        {/* Layer Foto Utama & Cutout per Anggota */}
        <div className="relative w-full md:max-h-[540px] overflow-hidden">
          <img
            src={uchihaImg}
            alt="Tim GenoPath"
            className={`w-full h-auto md:h-[540px] md:object-cover md:object-top block silky-glide transition-all duration-500 will-change-transform ${
              focusedId !== null ? 'blur-md brightness-50 dark:brightness-50 scale-105' : 'blur-0 brightness-100 scale-100'
            }`}
          />

          {/* Layer PNG Transparan Cutout per Anggota */}
          {TEAM_DATA.map((member) => {
            const isActive = focusedId === member.id;
            const originStyle = { '--origin-x': member.originX } as React.CSSProperties;

            return (
              <React.Fragment key={member.id}>
                {/* 1A. Ekor Cahaya */}
                <img
                  src={member.cutoutUrl}
                  alt=""
                  aria-hidden="true"
                  style={originStyle}
                  className={`snake-glow-tail absolute inset-0 w-full h-full object-fill md:object-cover md:object-top pointer-events-none silky-glide transition-[opacity,transform] ${
                    isActive
                      ? 'opacity-90 scale-105 duration-500 delay-100'
                      : 'opacity-0 scale-100 duration-150 delay-0'
                  }`}
                />

                {/* 1B. Kepala Cahaya */}
                <img
                  src={member.cutoutUrl}
                  alt=""
                  aria-hidden="true"
                  style={originStyle}
                  className={`snake-glow-head absolute inset-0 w-full h-full object-fill md:object-cover md:object-top pointer-events-none silky-glide transition-[opacity,transform] ${
                    isActive
                      ? 'opacity-100 scale-105 duration-500 delay-100'
                      : 'opacity-0 scale-100 duration-150 delay-0'
                  }`}
                />

                {/* 2. Layer Foto Cutout Asli */}
                <img
                  src={member.cutoutUrl}
                  alt={member.name}
                  className={`absolute inset-0 w-full h-full object-fill md:object-cover md:object-top pointer-events-none silky-glide will-change-[opacity,transform] transition-[opacity,transform,filter] ${
                    isActive
                      ? 'opacity-100 scale-105 brightness-105 dark:brightness-110 duration-500 delay-0'
                      : 'opacity-0 scale-100 duration-500 delay-75'
                  }`}
                />
              </React.Fragment>
            );
          })}

          {/* Gradasi Deep Marine Slate-Teal di Sisi Bawah Foto */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#102f45] via-[#102f45]/45 to-transparent dark:from-[#0a1d2b] dark:via-[#0a1d2b]/55 pointer-events-none" />
        </div>

        {/* Baris Kartu Anggota (Rectangular Neo-Brutalist Cards) */}
        <div className="relative md:absolute md:bottom-0 md:inset-x-0 z-20 pt-4 px-5 pb-5 bg-[var(--gp-rail)] md:bg-transparent grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 md:gap-4">
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
                onFocus={() => handleActivate(member)}
                onBlur={handleDeactivate}
                onClick={() => handleActivate(member)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleActivate(member);
                  }
                  if (event.key === 'Escape') handleDeactivate();
                }}
                onMouseEnter={() => handleActivate(member)}
                onMouseLeave={handleDeactivate}
                className={`group relative rounded-xl p-1.5 cursor-pointer select-none silky-glide transition-all duration-300 will-change-transform ${
                  isSelected
                    ? 'translate-x-1 -translate-y-1.5 scale-[1.03] z-30 bg-[#d9e8b8] shadow-[3px_3px_0px_0px_#8bc4ee] dark:shadow-[3px_3px_0px_0px_#fcfcf8]'
                    : isBlurred
                    ? '-translate-y-1 opacity-40 scale-95 bg-[#23464e]/75 dark:bg-[#192b30]/80 shadow-[6px_6px_0px_0px_rgba(180,200,215,0.14)]'
                    : '-translate-y-1 hover:translate-x-1 hover:-translate-y-1.5 bg-[#fcfcf8] dark:bg-[#d9e8b8]/90 shadow-[8px_8px_0px_0px_rgba(217,232,184,0.45)] dark:shadow-[8px_8px_0px_0px_rgba(139,196,238,0.35)] hover:bg-[#d9e8b8] dark:hover:bg-[#d9e8b8] hover:shadow-[3px_3px_0px_0px_#8bc4ee]'
                }`}
              >
                {/* Bodi Dalam Deep Marine Slate-Teal */}
                <div
                  className={`h-full rounded-lg p-2.5 border transition-colors duration-300 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#102f45] dark:bg-[#0a1d2b] border-[#d9e8b8]/70'
                      : 'bg-[#163a4d] dark:bg-[#0f2533] border-[#527380]/50 group-hover:bg-[#102f45] dark:group-hover:bg-[#0a1d2b]'
                  }`}
                >
                  <span className="text-[11px] font-mono text-[#b4c8d7] block mb-1 font-bold">
                    {member.nim}
                  </span>

                  <h3 className="font-extrabold text-xs text-[#eef3e8] dark:text-[#e9f0f5] leading-snug min-h-[32px] [word-break:keep-all]">
                    {member.name}
                  </h3>

                  <p
                    className={`text-[11px] font-mono font-bold mt-1.5 transition-colors duration-300 ${
                      isSelected
                        ? 'text-[#d9e8b8]'
                        : 'text-[#8bc4ee] group-hover:text-[#d9e8b8]'
                    }`}
                  >
                    {member.role}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default TeamSection;