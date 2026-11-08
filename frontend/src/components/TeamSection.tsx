import React, { useState } from 'react';

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
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 border-b border-slate-300 dark:border-slate-800 pb-3 gap-2 transition-colors">
        <div>
          {/* Heading Utama (Level 2) */}
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full inline-block" />
            Tim Pengembang Proyek Praktikum
          </h2>
          {/* Sub-header dinaikkan dari 11px ke text-xs (12px) & kontras ditingkatkan */}
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium ml-4 mt-0.5">
            Program Studi Bioinformatika — IPB University
          </p>
        </div>
        {/* Badge dinaikkan dari 10px ke text-xs (12px) */}
        <span className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold uppercase w-fit">
          KONTRIBUTOR MAHASISWA
        </span>
      </div>

      {/* Frame Foto Utama & Layer Interaktif */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl bg-slate-950 border border-slate-800 min-h-[440px] flex flex-col justify-end transition-colors">
        
        {/* Layer Foto Utama & Cutout per Anggota */}
        <div className="absolute inset-0 w-full h-full bg-slate-950">
          <img
            src={uchihaImg} 
            alt="Tim GenoPath"
            className={`w-full h-full object-cover object-top transition-all duration-500 ${
              focusedId !== null ? 'blur-md brightness-50 scale-105' : 'blur-0 brightness-100 scale-100'
            }`}
          />

          {/* Layer PNG Transparan Cutout per Anggota */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />
        </div>

        {/* Baris Kartu Anggota di Bagian Bawah Gambar */}
        <div className="relative z-20 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {TEAM_DATA.map((member) => {
            const isSelected = focusedId === member.id;
            const isBlurred = focusedId !== null && !isSelected;

            return (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                className={`rounded-xl p-3 transition-all duration-300 cursor-pointer select-none backdrop-blur-md ${
                  isSelected
                    ? 'bg-slate-900/95 border-2 border-blue-500 ring-2 ring-blue-500/20 -translate-y-2 scale-105 z-30 shadow-2xl'
                    : isBlurred
                    ? 'bg-slate-900/40 opacity-40 blur-[1px] scale-95 border border-slate-800'
                    : 'bg-slate-900/80 hover:bg-slate-900/95 border border-slate-800 hover:border-slate-700 hover:-translate-y-1 hover:shadow-lg'
                }`}
              >
                {/* NIM: Dinaikkan dari 8px ke text-xs (12px) */}
                <span className="text-xs font-mono text-slate-400 block mb-1">
                  {member.nim}
                </span>

                {/* Nama Anggota: Menggunakan <h3> (Mengoreksi aksesibilitas skipped-heading h2 -> h3) */}
                <h3 className="font-bold text-xs text-slate-100 leading-snug min-h-[32px] [word-break:keep-all]">
                  {member.name.split('').map((char, charIdx) => {
                    const isCharAnimating =
                      animatingChar?.memberId === member.id &&
                      animatingChar?.charIdx === charIdx;

                    return (
                      <span
                        key={charIdx}
                        className={`inline-block transition-transform duration-200 ${
                          isCharAnimating
                            ? 'scale-125 text-blue-400 font-black -translate-y-0.5'
                            : 'scale-100'
                        }`}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    );
                  })}
                </h3>

                {/* Peran / Role: Dinaikkan dari 9.5px ke text-xs (12px) */}
                <p className="text-xs text-blue-400 font-medium mt-1">
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