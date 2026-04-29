import { Download } from "lucide-react";
import { useState } from "react";

interface ExportButtonProps {
  data: any[];
  filename: string;
  type: "receitas" | "despesas";
}

export function ExportButton({ data, filename, type }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportToCSV = () => {
    if (!data.length) return;

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(","));
    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const exportToPDF = () => {
    alert("Exportação para PDF em desenvolvimento. Use CSV por enquanto.");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Download size={18} />
        Exportar
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 rounded-t-lg transition-colors"
            >
              Exportar como CSV
            </button>
            <button
              onClick={exportToPDF}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 rounded-b-lg transition-colors"
            >
              Exportar como PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
