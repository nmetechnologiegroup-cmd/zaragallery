import React from 'react';
import { AuditLogEntry } from '../types';
import { ShieldCheck, Search, Download } from 'lucide-react';

interface AuditLogProps {
  logs: AuditLogEntry[];
}

export default function AuditLog({ logs }: AuditLogProps) {
  const [search, setSearch] = React.useState('');
  const [selectedLog, setSelectedLog] = React.useState<AuditLogEntry | null>(null);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.user.toLowerCase().includes(search.toLowerCase()) ||
    log.details.toLowerCase().includes(search.toLowerCase())
  );

  const getSeverityColor = (severity: AuditLogEntry['severity']) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'WARNING': return 'text-orange-600 bg-orange-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const exportLogs = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Utilisateur,Action,Détails,Gravité\n"
      + filteredLogs.map(log => `${log.timestamp},${log.user},${log.action},"${log.details}",${log.severity}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white flex-1 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12 border-b border-neutral-100 pb-8">
          <div>
            <h2 className="text-4xl font-black text-black tracking-tighter uppercase mb-2 flex items-center gap-4">
              <ShieldCheck className="w-10 h-10" /> Journal d'Audit
            </h2>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.3em]">Surveillance des actions critiques et sécurité du système</p>
          </div>
          <button 
            onClick={exportLogs}
            className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition shadow-xl flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
        </div>

        <div className="mb-8 relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Rechercher une action, un utilisateur..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none text-xs font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-black transition-all"
          />
        </div>

        <div className="bg-white border border-neutral-100 shadow-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Date & Heure</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Utilisateur</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Action</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Détails</th>
                <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Gravité</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr 
                  key={log.id} 
                  onClick={() => setSelectedLog(log)}
                  className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors cursor-pointer group"
                >
                  <td className="p-6">
                    <p className="text-[10px] font-mono font-bold text-neutral-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </td>
                  <td className="p-6">
                    <p className="text-xs font-black uppercase tracking-tight text-black">{log.user}</p>
                  </td>
                  <td className="p-6">
                    <span className="text-[9px] font-black px-3 py-1 bg-neutral-100 rounded-full tracking-wider uppercase">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-6">
                    <p className="text-xs text-neutral-600 leading-relaxed max-w-md italic">"{log.details}"</p>
                  </td>
                  <td className="p-6 text-right">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase ${getSeverityColor(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <div className="p-20 text-center text-neutral-400 uppercase tracking-widest text-xs font-bold">
              Aucune trace trouvée pour cette recherche
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-neutral-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white max-w-xl w-full border-2 border-black p-12 animate-in zoom-in duration-150 relative">
              <button 
                onClick={() => setSelectedLog(null)}
                className="absolute right-8 top-8 text-neutral-400 hover:text-black transition-colors"
              >
                <ShieldCheck className="w-6 h-6" />
              </button>
              
              <div className="mb-10 border-b border-neutral-100 pb-8">
                 <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.4em] mb-2">Détails de l'évènement</h3>
                 <h2 className="text-3xl font-black uppercase tracking-tighter text-black">{selectedLog.action}</h2>
              </div>
              
              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-8">
                    <div>
                       <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Opérateur</label>
                       <p className="text-lg font-black uppercase tracking-tight">{selectedLog.user}</p>
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Horodatage</label>
                       <p className="text-sm font-mono font-bold text-neutral-600">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                    </div>
                 </div>
                 
                 <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Informations Exploitables</label>
                    <div className="bg-neutral-50 p-6 border-l-2 border-black italic text-neutral-700 text-sm leading-relaxed">
                       {selectedLog.details}
                    </div>
                 </div>

                 <div className="pt-4 flex justify-between items-center">
                    <span className={`text-[10px] font-black px-4 py-2 rounded-full tracking-[0.2em] uppercase ${getSeverityColor(selectedLog.severity)}`}>
                       Priorité {selectedLog.severity}
                    </span>
                    <button 
                      onClick={() => setSelectedLog(null)}
                      className="text-[10px] font-black uppercase tracking-widest border-b border-black py-1 hover:text-neutral-500 hover:border-neutral-500 transition-all"
                    >
                      Fermer le rapport
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
