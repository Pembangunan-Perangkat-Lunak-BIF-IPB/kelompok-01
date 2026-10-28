import React, { useState } from 'react';

// Pengimporan berkas dari src/assets/ (Tetap dipertahankan penuh)
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
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [animatingChar, setAnimatingChar] = useState<{ memberId: string; charIdx: number } | null>(null);

  const handleMemberClick = (member: TeamMember) => {
    if (focusedId === member.id) {
      setFocusedId(null);
      return;
    }

    setFocusedId(member.id);

    // Animasi perbesar huruf satu per satu dari kiri ke kanan
    const chars = member.name.split('');
    chars.forEach((_, idx) => {
      setTimeout(() => {
        setAnimatingChar({ memberId: member.id, charIdx: idx });
      }, idx * 60);
    });

    setTimeout(() => {
      setAnimatingChar(null);
    }, chars.length * 60 + 200);
  };

  return (
    <section className="max-w-5xl mx-auto pt-4 pb-16">
      {/* Header Judul di Luar Foto */}
      {/* Penambahan: Pembatas garis dan teks adaptif tema siang/malam (dark:border-slate-800/60 & dark:text-slate-200) */}
      <div className="flex justify-between items-end mb-3 border-b border-slate-300/40 dark:border-slate-800/60 pb-2 transition-colors duration-300">
        <div>
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span> Tim Pengembang Proyek Praktikum
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium ml-4 mt-0.5">
            Program Studi Bioinformatika — IPB University
          </p>
        </div>
        {/* Penambahan: Badge kristal adaptif mode malam */}
        <span className="glass-card text-[10px] font-mono text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl uppercase font-bold transition-all">
          KONTRIBUTOR MAHASISWA
        </span>
      </div>

      {/* Frame Foto Utama & Layer Interaktif */}
      {/* Penambahan: Border transparan dan efek bayangan kristal pada pembungkus foto utama */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-950 border border-slate-300/40 dark:border-slate-800/80 min-h-[440px] flex flex-col justify-end transition-colors duration-300">
        
        {/* Layer Foto Utama & Cutout per Anggota */}
        <div className="absolute inset-0 w-full h-full bg-slate-950">
          <img
            src={uchihaImg} 
            alt="Tim GenoPath"
            className={`w-full h-full object-cover object-top transition-all duration-500 ${
              focusedId !== null ? 'blur-md brightness-50 scale-105' : 'blur-0 brightness-100 scale-100'
            }`}
          />

          {/* Layer PNG Transparan Cutout per Anggota (Tetap utuh) */}
          {TEAM_DATA.map((member) => (
            <img
              key={member.id}
              src={member.cutoutUrl}
              alt={member.name}
              className={`absolute inset-0 w-full h-full object-cover object-top pointer-events-none transition-all duration-500 ${
                focusedId === member.id ? 'opacity-100 scale-105 brightness-110' : 'opacity-0 scale-100'
              }`}
            />
          ))}

          {/* Gradasi Gelap di Sisi Bawah Kartu Nama */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent pointer-events-none"></div>
        </div>

        {/* Baris Kartu Anggota di Bagian Bawah Gambar */}
        <div className="relative z-20 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {TEAM_DATA.map((member) => {
            const isSelected = focusedId === member.id;
            const isBlurred = focusedId !== null && !isSelected;

            return (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                // Penambahan: Penyesuaian skema warna kartu saat terpilih, kabur, maupun default menggunakan gaya kristal transparan
                className={`rounded-xl p-2.5 transition-all duration-500 cursor-pointer select-none backdrop-blur-md ${
                  isSelected
                    ? 'bg-white/95 dark:bg-slate-900/95 border-2 border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/20 dark:ring-blue-400/30 -translate-y-2 scale-105 z-30 shadow-xl'
                    : isBlurred
                    ? 'bg-white/30 dark:bg-slate-900/30 opacity-40 blur-[1px] scale-95 border border-white/20 dark:border-slate-800/30'
                    : 'glass-card hover:bg-white/90 dark:hover:bg-slate-900/90 hover:-translate-y-1 hover:shadow-xl'
                }`}
              >
                {/* Penambahan: Warna NIM adaptif mode malam */}
                <span className="text-[8px] font-mono text-slate-500 dark:text-slate-400 block mb-0.5">
                  {member.nim}
                </span>

                {/* Judul Nama & Animasi Per Karakter */}
                <h4 className="font-bold text-[11px] text-slate-900 dark:text-slate-100 leading-tight min-h-[26px] [word-break:keep-all]">
                  {member.name.split('').map((char, charIdx) => {
                    const isCharAnimating =
                      animatingChar?.memberId === member.id &&
                      animatingChar?.charIdx === charIdx;

                    return (
                      <span
                        key={charIdx}
                        className={`inline-block transition-transform duration-200 ${
                          isCharAnimating
                            ? 'scale-130 text-blue-600 dark:text-blue-400 font-black -translate-y-0.5'
                            : 'scale-100'
                        }`}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    );
                  })}
                </h4>

                {/* Peran / Role */}
                <p className="text-[9.5px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
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