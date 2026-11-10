const members = [{"name": "Roni Andripan", "role": "Software Tester", "nim": "G4401241005"}, {"name": "Fajar Dhuha Zafran", "role": "Back-End Developer", "nim": "G4401241069"}, {"name": "Rafif Alfarrel Nugroho", "role": "Project Manager", "nim": "G4401241015"}, {"name": "Azril Ilham Fajrian", "role": "Front-End Developer", "nim": "G4401241028"}, {"name": "Aldo Rafiz Aprilian", "role": "System Analyst", "nim": "G4401241031"}];

export function TeamSection() {
  return <section className="max-w-5xl mx-auto py-6 space-y-4">
    <h2 className="font-bold text-lg">Tim GenoPath</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {members.map(member => <article key={member.nim} className="glass-card rounded-2xl p-4 space-y-2">
        <div aria-hidden="true" className="rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 w-11 h-11 flex items-center justify-center font-semibold">
          {member.name.split(' ').map(part => part[0]).slice(0, 2).join('')}
        </div>
        <h3 className="font-semibold text-sm">{member.name}</h3>
        <p className="text-xs text-blue-700 dark:text-blue-300">{member.role}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">{member.nim}</p>
      </article>)}
    </div>
  </section>;
}
export default TeamSection;
