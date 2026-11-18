
interface ResultVisualizationsProps {
  counts: {
    total_variants: number;
    snps: number;
    indels: number;
    other: number;
    unclassified: number;
  };
}

export function ResultVisualizations({ counts }: ResultVisualizationsProps) {
  const previewCounts = {
    total_variants: 100,
    snps: 65,
    indels: 20,
    other: 10,
    unclassified: 5,
  };

  const displayCounts = counts.total_variants > 0
    ? counts
    : previewCounts;
  const total = displayCounts.total_variants;

  const categories = [
    { label: 'SNP', value: displayCounts.snps },
    { label: 'InDel', value: displayCounts.indels },
    { label: 'Other', value: displayCounts.other },
    { label: 'Tidak terklasifikasi', value: displayCounts.unclassified },
  ];

  const formatNumber = (value: number) =>
    value.toLocaleString('id-ID');

  return (
    <section className="gp-section p-5 space-y-5">
      <div>
        <h2 className="text-lg font-bold">Visualisasi Hasil Analisis</h2>

        {counts.total_variants === 0 && (
          <p className="text-amber-700 text-sm font-semibold">
            PREVIEW MODE — Data sementara, bukan hasil analisis biologis.
          </p>
        )}

        <p className="text-sm mt-1 text-slate-600 dark:text-slate-400">
          Distribusi tipe varian berdasarkan seluruh record hasil analisis.
        </p>
      </div>  

      {total === 0 ? (
        <p className="text-sm">
          Belum ada record varian untuk divisualisasikan.
        </p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">
                Komposisi Tipe Varian
              </h3>
              <span className="text-xs text-slate-500">
                Total: {formatNumber(total)}
              </span>
            </div>

            <div
              className="flex h-8 w-full overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700"
              role="img"
              aria-label="Diagram komposisi tipe varian"
            >
              {categories.map((item) => {
                const percentage = (item.value / total) * 100;

                return percentage > 0 ? (
                  <div
                    key={item.label}
                    title={`${item.label}: ${formatNumber(item.value)} (${percentage.toFixed(1)}%)`}
                    style={{
                      width: `${percentage}%`,
                      backgroundColor:
                        item.label === 'SNP' ? '#2563eb' :
                        item.label === 'InDel' ? '#0d9488' :
                        item.label === 'Other' ? '#d97706' :
                        '#64748b',
                    }}
                  />
                ) : null;
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((item) => {
              const percentage =
                total > 0 ? (item.value / total) * 100 : 0;

              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {formatNumber(item.value)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor:
                          item.label === 'SNP' ? '#2563eb' :
                          item.label === 'InDel' ? '#0d9488' :
                          item.label === 'Other' ? '#d97706' :
                          '#64748b',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Persentase dihitung terhadap total record varian. Visualisasi
        mengikuti ringkasan seluruh hasil analisis dan tidak terpengaruh
        oleh filter atau pembagian halaman tabel.
      </p>
    </section>
  );
}

export default ResultVisualizations;