import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const MeetingsCard = ({ meetings, loading, onMeetingClick }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const sortedMeetings = useMemo(() => {
    if (!meetings || meetings.length === 0) return [];
    
    // Filter
    const filtered = searchTerm
      ? meetings.filter(m => 
          (m.storeName && m.storeName.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : meetings;

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.startMoment || a.date || 0);
      const dateB = new Date(b.startMoment || b.date || 0);
      return dateB - dateA; // Descending order
    });
  }, [meetings, searchTerm]);

  const totalPages = Math.ceil(sortedMeetings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleMeetings = sortedMeetings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handleExport = () => {
    const headers = ['Loja', 'Data e Hora', 'Duração', 'Participantes', 'Nota'];
    
    // Use sortedMeetings which respects the search filter but is NOT paginated
    const dataToExport = sortedMeetings.map(m => [
      m.storeName,
      formatDate(m.startMoment || m.date),
      formatDuration(m),
      Array.isArray(m.participants) ? m.participants.map(p => p.name || p.email).join(', ') : '',
      m.averageScore || '-'
    ]);
    exportToCSV(dataToExport, headers, 'Reunioes');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  const formatDuration = (meeting) => {
    if (meeting.durationMinutes !== undefined && meeting.durationMinutes !== null) {
      return `${meeting.durationMinutes} minutos`;
    }
    const seconds = meeting.duration || meeting.callDuration;
    if (seconds) {
      const mins = Math.floor(seconds / 60);
      return `${mins} minutos`;
    }
    return '-';
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
      transition={{ delay: 0.3 }}
      className="bg-[#2F2F2F] rounded-lg border border-[#3C4144] p-6 flex flex-col h-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-domine font-semibold text-white">Reuniões</h2>
            <span className="text-xs text-gray-400 font-manrope self-center mt-1">
            Total: {sortedMeetings.length}
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

      <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">
        <div className="flex-1">
          <table className="w-full min-w-[600px]">
            <thead className="sticky top-0 bg-[#2F2F2F] z-10 shadow-sm shadow-[#1B1B1B]">
              <tr className="border-b border-[#3C4144]">
                <th className="text-left text-xs font-manrope font-semibold text-gray-300 pb-3 px-2">Loja</th>
                <th className="text-left text-xs font-manrope font-semibold text-gray-300 pb-3 px-2">Data e Hora</th>
                <th className="text-center text-xs font-manrope font-semibold text-gray-300 pb-3 px-2">Duração</th>
                <th className="text-left text-xs font-manrope font-semibold text-gray-300 pb-3 px-2">Participantes</th>
              </tr>
            </thead>
            <tbody>
              {visibleMeetings.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-sm text-gray-500 font-manrope">
                    {searchTerm ? 'Nenhuma reunião encontrada para sua busca.' : 'Nenhuma reunião encontrada.'}
                  </td>
                </tr>
              ) : (
                visibleMeetings.map((meeting, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => onMeetingClick && onMeetingClick(meeting)}
                    className="border-b border-[#3C4144] hover:bg-[#33393D] transition-colors last:border-0 cursor-pointer group"
                  >
                    <td className="py-3 px-2 align-middle">
                      <div className="text-sm font-manrope font-medium text-white group-hover:text-gold-light transition-colors">
                        {meeting.storeName}
                      </div>
                    </td>
                    <td className="py-3 px-2 align-middle text-sm font-manrope text-gray-300">
                      {formatDate(meeting.startMoment || meeting.date)}
                    </td>
                    <td className="py-3 px-2 align-middle text-center text-sm font-manrope text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {formatDuration(meeting)}
                      </div>
                    </td>
                    <td className="py-3 px-2 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(meeting.participants) && meeting.participants.length > 0 ? (
                          meeting.participants.map((p, pIdx) => (
                            <Badge key={pIdx} variant="outline" className="text-[10px] border-[#4C4E50] text-gray-300">
                              {p.name || p.email || 'Convidado'}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

export default MeetingsCard;