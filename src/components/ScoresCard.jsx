import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, ArrowUpDown, ChevronLeft, Search, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportToCSV } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const ScoresCard = ({
  meetings,
  loading,
  filters
}) => {
  const [expandedRows, setExpandedRows] = useState({});
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [nestedSort, setNestedSort] = useState({
    field: 'date',
    direction: 'desc'
  }); // Sorting for nested rows
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const { processedData, summaryStats } = useMemo(() => {
    if (!meetings || meetings.length === 0) return { processedData: [], summaryStats: { avgScore: 0, totalVisits: 0 } };

    const storeMap = {};
    let globalTotalScore = 0;
    let globalTotalCount = 0;

    meetings.forEach(meeting => {
      const storeName = meeting.storeName;
      if (!storeName) return;
      if (!storeMap[storeName]) {
        storeMap[storeName] = {
          store: storeName,
          totalScore: 0,
          count: 0,
          items: []
        };
      }

      // Calculate Average Score for this meeting
      let meetingScore = 0;
      if (meeting.averageScore !== undefined && meeting.averageScore !== null) {
        meetingScore = parseFloat(meeting.averageScore);
      } else if (meeting.results && Array.isArray(meeting.results)) {
        const validScores = meeting.results.filter(r => r.score !== undefined && r.score !== null).map(r => parseFloat(r.score));
        if (validScores.length > 0) {
          meetingScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        }
      }
      
      // Update Store Stats
      storeMap[storeName].totalScore += meetingScore;
      storeMap[storeName].count += 1;

      // Update Global Stats (using individual meeting scores for accurate global average)
      globalTotalScore += meetingScore;
      globalTotalCount += 1;

      // Extract Items
      const results = meeting.results || [];
      const meetingDate = meeting.startMoment || meeting.date;
      results.forEach(res => {
        storeMap[storeName].items.push({
          item: res.item || 'Item sem nome',
          score: res.score !== undefined && res.score !== null ? parseFloat(res.score) : 0,
          comment: res.comment || '',
          date: meetingDate
        });
      });

      // Backward compatibility
      if (results.length === 0 && (meeting.questions || meeting.answers)) {
        const oldItems = meeting.questions || meeting.answers || [];
        oldItems.forEach(q => {
          storeMap[storeName].items.push({
            item: q.question || q.label || q.text || 'Item sem nome',
            score: parseFloat(q.score || q.value || 0),
            comment: q.comment || q.observation || '',
            date: meeting.date || meetingDate
          });
        });
      }
    });

    // Finalize data
    const result = Object.values(storeMap).map(store => {
      const sortedItems = [...store.items].sort((a, b) => {
        if (nestedSort.field === 'score') {
          return nestedSort.direction === 'asc' ? a.score - b.score : b.score - a.score;
        } else {
          return nestedSort.direction === 'asc' ? new Date(a.date || 0) - new Date(b.date || 0) : new Date(b.date || 0) - new Date(a.date || 0);
        }
      });
      return {
        ...store,
        average: store.count > 0 ? (store.totalScore / store.count).toFixed(2) : '0.00',
        rawAverage: store.count > 0 ? (store.totalScore / store.count) : 0,
        items: sortedItems
      };
    });

    const avgScore = globalTotalCount > 0 ? globalTotalScore / globalTotalCount : 0;

    return { 
        processedData: result, 
        summaryStats: {
            avgScore,
            totalVisits: globalTotalCount
        }
    };
  }, [meetings, nestedSort]);

  // Filter & Sort
  const displayData = useMemo(() => {
    // Filter
    const filtered = searchTerm 
      ? processedData.filter(r => r.store.toLowerCase().includes(searchTerm.toLowerCase()))
      : processedData;

    // Sort
    return filtered.sort((a, b) => {
      const scoreA = a.rawAverage;
      const scoreB = b.rawAverage;
      
      if (Math.abs(scoreA - scoreB) < 0.001) {
          return a.store.localeCompare(b.store);
      }
      return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });
  }, [processedData, searchTerm, sortOrder]);

  const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleData = displayData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const toggleRow = storeName => {
    setExpandedRows(prev => ({
      ...prev,
      [storeName]: !prev[storeName]
    }));
  };

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const toggleNestedSort = field => {
    setNestedSort(prev => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === 'desc' ? 'asc' : 'desc'
        };
      }
      return {
        field,
        direction: 'desc'
      };
    });
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handleExport = () => {
    const headers = ['Loja', 'Visitas', 'Nota Média'];
    
    // Use displayData which respects the search filter but is NOT paginated
    const dataToExport = displayData.map(row => [
      row.store,
      row.count,
      row.average
    ]);
    exportToCSV(dataToExport, headers, 'Notas_Comentarios');
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

  const isDesc = sortOrder === 'desc';

  return <motion.div initial={{
    opacity: 0,
    y: 20
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    delay: 0.1
  }} className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-domine font-semibold text-white">Notas e Comentários</h2>
            <span className="text-xs text-gray-400 font-manrope self-center mt-1">
            Total: {displayData.length}
            </span>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                  type="text"
                  placeholder="Buscar por loja..."
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
          {displayData.length === 0 ? (
              <div className="text-center text-gray-400 font-manrope py-8">
                  Nenhuma loja encontrada.
              </div>
          ) : (
            <table className="w-full min-w-[600px] border-collapse relative">
                <thead className="sticky top-0 bg-[#2F2F2F] z-10 shadow-sm shadow-[#1B1B1B]">
                <tr className="border-b border-[#3C4144]">
                    <th className="w-10 bg-[#2F2F2F]"></th>
                    <th className="text-left text-sm font-manrope font-semibold text-gray-300 pb-3 px-2 bg-[#2F2F2F]">Loja</th>
                    <th className="text-center text-sm font-manrope font-semibold text-gray-300 pb-3 px-2 bg-[#2F2F2F]">Visitas</th>
                    <th className="text-center text-sm font-manrope font-semibold text-gray-300 pb-3 px-2 bg-[#2F2F2F]">
                    <button onClick={toggleSort} className="flex items-center justify-center gap-1 mx-auto hover:text-gold-light transition-colors group">
                        Nota
                        <ArrowUpDown className={`h-3 w-3 transition-transform ${isDesc ? '' : 'rotate-180'}`} />
                    </button>
                    </th>
                </tr>
                </thead>
                <tbody>
                {/* Summary Row */}
                <tr className="bg-[#E8B930]/10 border-b border-[#E8B930]/30 font-bold">
                    <td className="py-3 px-2"></td>
                    <td className="py-3 px-2 text-sm font-domine text-[#E8B930]">MÉDIA GERAL</td>
                    <td className="py-3 px-2 text-sm font-manrope text-center text-white">{summaryStats.totalVisits}</td>
                    <td className="py-3 px-2 text-center">
                        <span className={`text-sm font-manrope font-bold px-2 py-0.5 rounded ${summaryStats.avgScore >= 9 ? 'bg-green-500/10 text-green-400' : summaryStats.avgScore <= 7 ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-500'}`}>
                            {summaryStats.avgScore.toFixed(2)}
                        </span>
                    </td>
                </tr>

                {visibleData.map(row => <React.Fragment key={row.store}>
                    <tr className="border-b border-[#3C4144] hover:bg-[#33393D] transition-colors last:border-0">
                        <td className="py-3 px-2 text-center align-middle">
                        <Button variant="ghost" size="icon" onClick={() => toggleRow(row.store)} className="h-6 w-6 text-gray-400 hover:text-white hover:bg-[#3C4144]">
                            {expandedRows[row.store] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        </td>
                        <td className="py-3 px-2 text-sm font-manrope text-white font-medium align-middle">{row.store}</td>
                        <td className="py-3 px-2 text-sm font-manrope text-center text-gray-300 align-middle">{row.count}</td>
                        <td className="py-3 px-2 text-center align-middle">
                        <span className={`text-sm font-manrope font-bold px-2 py-0.5 rounded ${parseFloat(row.average) >= 9 ? 'bg-green-500/10 text-green-400' : parseFloat(row.average) <= 7 ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-500'}`}>
                            {row.average}
                        </span>
                        </td>
                    </tr>
                    {expandedRows[row.store] && <tr>
                        <td colSpan="4" className="bg-[#252525] p-0 border-b border-[#3C4144]">
                            <div className="p-4">
                            <table className="w-full">
                                <thead>
                                <tr className="border-b border-[#4C4E50]">
                                    <th className="text-left text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-[40%]">Avaliação</th>
                                    <th className="text-center text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-[10%]">
                                    <button onClick={() => toggleNestedSort('score')} className="flex items-center justify-center gap-1 mx-auto hover:text-gold-light transition-colors">
                                        Nota
                                        <ArrowUpDown className="h-3 w-3" />
                                    </button>
                                    </th>
                                    <th className="text-left text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-[35%]">Comentário</th>
                                    <th className="text-center text-xs font-manrope font-semibold text-gray-400 pb-2 px-2 w-[15%]">
                                    <button onClick={() => toggleNestedSort('date')} className="flex items-center justify-center gap-1 mx-auto hover:text-gold-light transition-colors">
                                        Data da reunião
                                        <ArrowUpDown className="h-3 w-3" />
                                    </button>
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {row.items.map((item, itemIdx) => <tr key={itemIdx} className="border-b border-[#3C4144] last:border-0 hover:bg-[#2F2F2F]">
                                    <td className="py-2 px-2 text-xs font-manrope text-gray-300 align-top">{item.item}</td>
                                    <td className="py-2 px-2 text-center align-top">
                                        <span className={`text-xs font-manrope font-semibold ${item.score >= 9 ? 'text-green-400' : item.score <= 7 ? 'text-red-400' : 'text-gray-300'}`}>
                                        {item.score.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-xs font-manrope text-gray-400 italic align-top">
                                        {item.comment ? `"${item.comment}"` : '-'}
                                    </td>
                                    <td className="py-2 px-2 text-xs font-manrope text-gray-400 text-center align-top">
                                        {formatDate(item.date)}
                                    </td>
                                    </tr>)}
                                {row.items.length === 0 && <tr>
                                    <td colSpan="4" className="py-4 text-center text-xs text-gray-500">
                                        Nenhum item avaliado encontrado.
                                    </td>
                                    </tr>}
                                </tbody>
                            </table>
                            </div>
                        </td>
                        </tr>}
                    </React.Fragment>)}
                </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-[#3C4144] flex-shrink-0">
            <span className="text-xs text-gray-400 font-manrope mr-2">
              Página {currentPage} de {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>;
};
export default ScoresCard;