import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ChevronDown, Search, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const BadCommentsCard = ({
  meetings,
  loading
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Process and group bad comments
  const groupedBadComments = useMemo(() => {
    if (!meetings || meetings.length === 0) return [];
    const grouped = {};
    meetings.forEach(meeting => {
      const meetingDate = meeting.startMoment || meeting.date;
      const storeName = meeting.storeName;

      // Helper to process an item
      const processItem = (itemName, score, comment) => {
        if (score === undefined || score === null) return;
        const numScore = parseFloat(score);
        if (numScore === 1) {
          if (!grouped[itemName]) {
            grouped[itemName] = {
              item: itemName,
              count: 0,
              details: []
            };
          }
          grouped[itemName].count += 1;
          grouped[itemName].details.push({
            store: storeName,
            date: meetingDate,
            comment: comment || ''
          });
        }
      };

      // Look in results array (preferred)
      if (meeting.results && Array.isArray(meeting.results)) {
        meeting.results.forEach(res => {
          processItem(res.item || 'Item sem nome', res.score, res.comment);
        });
      }
      // Fallback to questions/answers if results empty
      else {
        const list = meeting.questions || meeting.answers || [];
        list.forEach(q => {
          processItem(q.question || q.label || q.text || 'Item sem nome', q.score || q.value, q.comment || q.observation);
        });
      }
    });

    const result = Object.values(grouped);
    
    // Filter
    const filtered = searchTerm
      ? result.filter(g => g.item.toLowerCase().includes(searchTerm.toLowerCase()))
      : result;

    // Convert to array and sort by count descending
    return filtered.sort((a, b) => b.count - a.count);
  }, [meetings, searchTerm]);

  const totalPages = Math.ceil(groupedBadComments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleGroups = groupedBadComments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  
  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };
  const toggleGroup = itemName => {
    setExpandedGroups(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };
  const handleExport = () => {
    const headers = ['Avaliação', 'Quantidade', 'Detalhes (Loja - Data - Comentário)'];
    
    // Use groupedBadComments which respects the search filter but is NOT paginated
    const dataToExport = groupedBadComments.map(g => {
        const detailsString = g.details.map(d => 
            `[${d.store} - ${formatDate(d.date)}: ${d.comment || 'Sem comentário'}]`
        ).join('; ');
        
        return [
            g.item,
            g.count,
            detailsString
        ];
    });
    exportToCSV(dataToExport, headers, 'Piores_Comentarios');
  };
  
  const formatDate = dateString => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return <div className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full">
        <Skeleton className="h-8 w-48 mb-6 bg-[#3C4144]" />
        <Skeleton className="h-64 w-full bg-[#3C4144]" />
      </div>;
  }
  
  return <motion.div initial={{
    opacity: 0,
    y: 20
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    delay: 0.2
  }} className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-domine font-semibold text-white">Piores Comentários</h2>
            <span className="text-xs text-gray-400 font-manrope self-center mt-1">
            Grupos: {groupedBadComments.length}
            </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                  type="text"
                  placeholder="Buscar por avaliação..."
                  value={searchTerm}
                  onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                  }}
                  className="pl-8 bg-[#33393D] border-[#4C4E50] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-[#E8B930] h-9"
              />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 border-[#4C4E50] bg-[#33393D] hover:bg-[#3C4144] hover:text-white"
            onClick={handleExport}
            title="Exportar Excel"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
          {groupedBadComments.length === 0 ? <div className="text-center text-gray-400 font-manrope py-8">
              {searchTerm ? 'Nenhum item encontrado para sua busca.' : 'Nenhum comentário com nota 1 encontrado.'}
            </div> : <table className="w-full min-w-[500px] border-collapse">
              <thead className="sticky top-0 bg-[#2F2F2F] z-10 shadow-sm shadow-[#1B1B1B]">
                <tr className="border-b border-[#3C4144]">
                  <th className="w-10 bg-[#2F2F2F]"></th>
                  <th className="text-left text-xs font-manrope font-semibold text-gray-300 pb-3 px-2 w-[70%]">Avaliação</th>
                  <th className="text-center text-xs font-manrope font-semibold text-gray-300 pb-3 px-2 w-[20%]">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((group, idx) => <React.Fragment key={idx}>
                    <tr className="border-b border-[#3C4144] hover:bg-[#33393D] transition-colors last:border-0 cursor-pointer" onClick={() => toggleGroup(group.item)}>
                      <td className="py-3 px-2 text-center align-middle">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white hover:bg-[#3C4144]">
                          {expandedGroups[group.item] ? <ChevronDown className="h-4 w-4 rotate-180 transition-transform" /> : <ChevronRight className="h-4 w-4 transition-transform" />}
                        </Button>
                      </td>
                      <td className="py-3 px-2 text-sm font-manrope text-white font-medium align-middle">
                        {group.item}
                      </td>
                      <td className="py-3 px-2 text-center align-middle">
                        <span className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold font-manrope">
                          {group.count}
                        </span>
                      </td>
                    </tr>
                    
                    {expandedGroups[group.item] && <tr>
                         <td colSpan="3" className="bg-[#252525] p-0 border-b border-[#3C4144]">
                           <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                             <table className="w-full">
                               <thead>
                                 <tr className="border-b border-[#4C4E50]">
                                   <th className="text-left text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-[25%]">Loja</th>
                                   <th className="text-left text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-[55%]">Comentário</th>
                                   <th className="text-center text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-[20%]">Data</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {group.details.map((detail, dIdx) => <tr key={dIdx} className="border-b border-[#3C4144] last:border-0 hover:bg-[#2F2F2F]">
                                     <td className="py-2 px-2 text-xs font-manrope text-gray-300 align-top">
                                       {detail.store}
                                     </td>
                                     <td className="py-2 px-2 text-xs font-manrope text-gray-400 italic align-top">
                                       {detail.comment ? `"${detail.comment}"` : '-'}
                                     </td>
                                     <td className="py-2 px-2 text-xs font-manrope text-gray-400 text-center align-top">
                                       {formatDate(detail.date)}
                                     </td>
                                   </tr>)}
                               </tbody>
                             </table>
                           </div>
                         </td>
                       </tr>}
                  </React.Fragment>)}
              </tbody>
            </table>}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-[#3C4144] flex-shrink-0">
            <span className="text-xs text-gray-400 font-manrope mr-2">
              Página {currentPage} de {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevPage} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextPage} disabled={currentPage === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>}
      </div>
    </motion.div>;
};
export default BadCommentsCard;