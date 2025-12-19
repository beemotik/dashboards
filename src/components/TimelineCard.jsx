import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ArrowUpDown, Search, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const TimelineCard = ({ meetings, loading }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'store', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  const { 
    tableData, 
    maxMeetings, 
    summaryStats, 
    totalStores 
  } = useMemo(() => {
    if (!meetings || meetings.length === 0) {
      return { 
        tableData: [], 
        maxMeetings: 0, 
        summaryStats: {
          engajamento: 0,
          avgEvolution: 0,
          avgScore: 0,
          columnAvgs: []
        },
        totalStores: 0
      };
    }

    const storeMap = {};
    let totalScoreSum = 0;
    let totalScoreCount = 0;
    
    // Process raw meetings
    meetings.forEach(m => {
        if(!m.storeName) return;
        if(!storeMap[m.storeName]) {
            storeMap[m.storeName] = [];
        }
        
        const score = m.averageScore !== undefined && m.averageScore !== null ? parseFloat(m.averageScore) : 0;
        
        storeMap[m.storeName].push({
            score,
            date: m.startMoment || m.date
        });

        totalScoreSum += score;
        totalScoreCount++;
    });

    // 1. Prepare Base Data for each store
    let max = 0;
    const data = Object.keys(storeMap).map(store => {
        const sortedMeetings = storeMap[store].sort((a, b) => new Date(a.date) - new Date(b.date));
        if (sortedMeetings.length > max) max = sortedMeetings.length;
        
        let evolution = null;
        if (sortedMeetings.length >= 2) {
            const firstScore = sortedMeetings[0].score;
            const lastScore = sortedMeetings[sortedMeetings.length - 1].score;
            if (firstScore !== 0) {
                evolution = ((lastScore - firstScore) / firstScore) * 100;
            }
        }

        return {
            store,
            meetings: sortedMeetings,
            evolution
        };
    });

    const totalUniqueStores = data.length;

    // 2. Calculate Summary Stats (Independent of search filter)
    // Engajamento: (Completed Meetings / (Total Stores * Max Meetings)) * 100
    const totalPotentialMeetings = totalUniqueStores * max;
    const engajamento = totalPotentialMeetings > 0 
      ? (totalScoreCount / totalPotentialMeetings) * 100 
      : 0;

    // Average Score (Global)
    const avgScore = totalScoreCount > 0 ? totalScoreSum / totalScoreCount : 0;

    // Average Evolution (of all stores that have evolution)
    const storesWithEvolution = data.filter(d => d.evolution !== null);
    const avgEvolution = storesWithEvolution.length > 0
      ? storesWithEvolution.reduce((acc, curr) => acc + curr.evolution, 0) / storesWithEvolution.length
      : 0;

    // Column Averages
    const columnAvgs = [];
    for (let i = 0; i < max; i++) {
      let colSum = 0;
      let colCount = 0;
      data.forEach(store => {
        if (store.meetings[i]) {
          colSum += store.meetings[i].score;
          colCount++;
        }
      });
      columnAvgs.push(colCount > 0 ? colSum / colCount : 0);
    }

    return { 
      tableData: data, 
      maxMeetings: max, 
      summaryStats: {
        engajamento,
        avgEvolution,
        avgScore,
        columnAvgs
      },
      totalStores: totalUniqueStores
    };
  }, [meetings]);

  // Filter & Sort for Display
  const processedDisplayData = useMemo(() => {
    // Filter
    const filtered = searchTerm
        ? tableData.filter(r => r.store.toLowerCase().includes(searchTerm.toLowerCase()))
        : tableData;

    // Sort
    return filtered.sort((a, b) => {
        if (sortConfig.key === 'evolution') {
            const valA = a.evolution !== null ? a.evolution : -999999;
            const valB = b.evolution !== null ? b.evolution : -999999;
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        } else {
            return sortConfig.direction === 'asc' 
                ? a.store.localeCompare(b.store) 
                : b.store.localeCompare(a.store);
        }
    });
  }, [tableData, searchTerm, sortConfig]);

  const totalPages = Math.ceil(processedDisplayData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleData = processedDisplayData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const toggleSort = (key) => {
    setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExport = () => {
    const headers = ['Loja', ...Array.from({ length: maxMeetings }).map((_, i) => `Reunião ${i + 1} - Data | Nota`), 'Evolução'];
    
    // Use processedDisplayData which respects the search filter but is NOT paginated
    const dataToExport = processedDisplayData.map(row => {
      const meetingCols = Array.from({ length: maxMeetings }).map((_, i) => {
        const m = row.meetings[i];
        return m ? `${formatDate(m.date)} | ${m.score.toFixed(2)}` : '-';
      });
      
      return [
        row.store,
        ...meetingCols,
        row.evolution !== null ? `${row.evolution.toFixed(2)}%` : '-'
      ];
    });

    exportToCSV(dataToExport, headers, 'Cronograma');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      }).format(date);
    } catch (e) {
      return '';
    }
  };

  const formatEvolution = (val) => {
    if (val === null) return '-';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 h-full">
        <Skeleton className="h-8 w-48 mb-6 bg-[#3C4144]" />
        <Skeleton className="h-64 w-full bg-[#3C4144]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 flex flex-col h-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-domine font-semibold text-white">Cronograma</h2>
            <span className="text-xs text-gray-400 font-manrope self-center mt-1">
            Total: {processedDisplayData.length}
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
        <div className="overflow-auto custom-scrollbar flex-1">
            {tableData.length === 0 ? (
                <div className="text-center text-gray-500 font-manrope py-10">
                     {searchTerm ? 'Nenhuma loja encontrada para sua busca.' : 'Nenhum dado disponível.'}
                </div>
            ) : (
                <table className="w-full min-w-[800px] border-collapse relative">
                    <thead className="sticky top-0 bg-[#2F2F2F] z-20 shadow-md">
                        <tr className="border-b border-[#3C4144]">
                            <th className="text-left text-xs font-manrope font-semibold text-gray-300 pb-3 px-4 w-[240px] bg-[#2F2F2F] sticky left-0 z-30 border-r border-[#3C4144]">
                                <button 
                                    onClick={() => toggleSort('store')}
                                    className="flex items-center gap-1 hover:text-gold-light transition-colors"
                                >
                                    Loja
                                    <ArrowUpDown className="h-3 w-3" />
                                </button>
                            </th>
                            {Array.from({ length: maxMeetings }).map((_, i) => (
                                <th key={i} className="text-center text-xs font-manrope font-semibold text-gray-300 pb-3 px-2 min-w-[140px] bg-[#2F2F2F]">
                                    Reunião {i + 1}
                                </th>
                            ))}
                            <th className="text-center text-xs font-manrope font-semibold text-gray-300 pb-3 px-2 min-w-[120px] bg-[#2F2F2F] border-l border-[#3C4144]">
                                <button 
                                    onClick={() => toggleSort('evolution')}
                                    className="flex items-center justify-center gap-1 mx-auto hover:text-gold-light transition-colors"
                                >
                                    Evolução
                                    <ArrowUpDown className="h-3 w-3" />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Summary Row */}
                        <tr className="bg-[#E8B930]/10 border-b border-[#E8B930]/30">
                            <td className="py-4 px-4 sticky left-0 z-10 border-r border-[#E8B930]/30 bg-[#3a3525]">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-bold text-[#E8B930] font-domine">RESUMO GERAL</span>
                                    <div className="flex flex-col text-[10px] font-manrope text-gray-300">
                                        <span>Engajamento: <span className="font-bold text-white">{summaryStats.engajamento.toFixed(2)}%</span></span>
                                        <span>Nota Média: <span className="font-bold text-white">{summaryStats.avgScore.toFixed(2)}</span></span>
                                    </div>
                                </div>
                            </td>
                            {Array.from({ length: maxMeetings }).map((_, i) => (
                                <td key={`sum-${i}`} className="py-3 px-2 text-center align-middle">
                                    {summaryStats.columnAvgs[i] > 0 ? (
                                        <span className={`text-xs font-bold font-manrope px-3 py-1 rounded
                                            ${summaryStats.columnAvgs[i] >= 9 ? 'text-green-400 bg-green-500/10' : 
                                              summaryStats.columnAvgs[i] <= 7 ? 'text-red-400 bg-red-500/10' : 'text-yellow-500 bg-yellow-500/10'}
                                        `}>
                                            Média: {summaryStats.columnAvgs[i].toFixed(2)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 text-xs">-</span>
                                    )}
                                </td>
                            ))}
                            <td className="py-3 px-2 text-center align-middle border-l border-[#E8B930]/30">
                                <span className={`text-sm font-bold font-manrope
                                    ${summaryStats.avgEvolution > 0 ? 'text-green-400' : ''}
                                    ${summaryStats.avgEvolution < 0 ? 'text-red-400' : ''}
                                    ${summaryStats.avgEvolution === 0 ? 'text-gray-400' : ''}
                                `}>
                                    {formatEvolution(summaryStats.avgEvolution)}
                                </span>
                            </td>
                        </tr>

                        {/* Data Rows */}
                        {visibleData.map((row, idx) => (
                            <tr key={idx} className="border-b border-[#3C4144] hover:bg-[#33393D] transition-colors last:border-0">
                                <td className="py-3 px-4 text-sm font-manrope font-medium text-white bg-[#2F2F2F] sticky left-0 z-10 border-r border-[#3C4144]">
                                    {row.store}
                                </td>
                                {Array.from({ length: maxMeetings }).map((_, i) => {
                                    const meeting = row.meetings[i];
                                    return (
                                        <td key={i} className="py-3 px-2 text-center">
                                            {meeting ? (
                                                <div className="flex flex-col items-center justify-center">
                                                    <span className={`text-xs font-manrope font-bold px-3 py-1 rounded mb-1 ${
                                                        meeting.score >= 9 ? 'bg-green-500/10 text-green-400' : 
                                                        meeting.score <= 7 ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-500'
                                                    }`}>
                                                        Nota: {meeting.score.toFixed(2)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-manrope">
                                                        {formatDate(meeting.date)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600">-</span>
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="py-3 px-2 text-center text-sm font-manrope font-bold border-l border-[#3C4144]">
                                    <span className={`
                                        ${row.evolution > 0 ? 'text-green-400' : ''}
                                        ${row.evolution < 0 ? 'text-red-400' : ''}
                                        ${row.evolution === 0 ? 'text-gray-400' : ''}
                                        ${row.evolution === null ? 'text-gray-600' : ''}
                                    `}>
                                        {formatEvolution(row.evolution)}
                                    </span>
                                </td>
                            </tr>
                        ))}
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
    </motion.div>
  );
};

export default TimelineCard;