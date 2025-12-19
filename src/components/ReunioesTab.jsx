
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Download, FileText, ChevronRight, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import MeetingDrawer from './MeetingDrawer';
import { useAppContext } from '@/context/AppContext';

const ReunioesTab = ({ meetings, loading, formatDate, getStatusColor, getStatusText, statusOptions, dateRange, onRefresh }) => {
  const { tenantId } = useAppContext();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDuration, setShowDuration] = useState(true);

  // Helper to handle both string and array participants
  const getParticipantName = (participants) => {
    if (!participants) return 'N/A';
    
    // If it's a string, try to parse it in case it's a JSON string, otherwise return as is
    if (typeof participants === 'string') {
       if (participants.trim().startsWith('[') || participants.trim().startsWith('{')) {
          try {
             const parsed = JSON.parse(participants);
             return getParticipantName(parsed); // Recurse with parsed object
          } catch (e) {
             return participants; // Return original string if parse fails
          }
       }
       return participants;
    }

    // If it's an array
    if (Array.isArray(participants)) {
      if (participants.length === 0) return 'N/A';
      return participants.map(p => {
         if (typeof p === 'string') return p;
         return p.name || p.email || 'Participante';
      }).join(', ');
    }
    
    // If it's a single object
    if (typeof participants === 'object') {
       return participants.name || participants.email || 'N/A';
    }

    return 'N/A';
  };

  // Filter meetings based on selected status (if filtered externally, meetings prop is already filtered)
  const filteredMeetings = meetings; 

  // Pagination logic
  const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);
  const paginatedMeetings = filteredMeetings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleRowClick = (meeting) => {
    setSelectedMeeting(meeting);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#252525] border-[#3C4144] shadow-xl">
        <CardHeader className="border-b border-[#3C4144] pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-domine text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#E8B930]" />
                Histórico de Reuniões
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                Total de {filteredMeetings.length} reuniões no período selecionado
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-[#4C4E50] text-gray-300 hover:bg-[#33393D] hover:text-white">
                    {showDuration ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                    Visualizar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                   <DropdownMenuCheckboxItem 
                      checked={showDuration}
                      onCheckedChange={setShowDuration}
                      className="hover:bg-[#3C4144] cursor-pointer"
                   >
                      Mostrar Duração
                   </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" className="border-[#4C4E50] text-gray-300 hover:bg-[#33393D] hover:text-white">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#2F2F2F]">
                <TableRow className="border-b-[#3C4144] hover:bg-[#2F2F2F]">
                  <TableHead className="text-gray-400 font-bold w-[200px]">Loja</TableHead>
                  <TableHead className="text-gray-400 font-bold">Data</TableHead>
                  <TableHead className="text-gray-400 font-bold">Participantes</TableHead>
                  {showDuration && <TableHead className="text-gray-400 font-bold">Duração</TableHead>}
                  <TableHead className="text-gray-400 font-bold">Status</TableHead>
                  <TableHead className="text-gray-400 font-bold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={showDuration ? 6 : 5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <div className="w-6 h-6 border-2 border-[#E8B930] border-t-transparent rounded-full animate-spin mb-2"></div>
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedMeetings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showDuration ? 6 : 5} className="h-32 text-center text-gray-500">
                      Nenhuma reunião encontrada neste período.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMeetings.map((meeting, idx) => (
                    <TableRow 
                      key={idx}
                      className="border-b-[#3C4144] hover:bg-[#2F2F2F] cursor-pointer transition-colors"
                      onClick={() => handleRowClick(meeting)}
                    >
                      <TableCell className="font-medium text-white">
                        {meeting.storeName}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex flex-col text-sm">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            {formatDate(meeting.startMoment).split(' ')[0]}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(meeting.startMoment).split(' ')[1]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {getParticipantName(meeting.participants)}
                      </TableCell>
                      {showDuration && (
                        <TableCell className="text-gray-300 font-mono text-sm">
                          {meeting.durationMinutes ? `${meeting.durationMinutes} min` : '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge 
                          className={`${getStatusColor(meeting.status)} border-0 font-medium`}
                        >
                          {getStatusText(meeting.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button 
                           variant="ghost" 
                           size="sm"
                           className="text-gray-400 hover:text-[#E8B930] hover:bg-[#E8B930]/10"
                         >
                           Detalhes
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#3C4144] flex items-center justify-between bg-[#2F2F2F]">
              <span className="text-xs text-gray-500">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredMeetings.length)} de {filteredMeetings.length} resultados
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0 border-[#4C4E50] bg-[#252525] text-gray-300 hover:bg-[#33393D] hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0 border-[#4C4E50] bg-[#252525] text-gray-300 hover:bg-[#33393D] hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <MeetingDrawer 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        meeting={selectedMeeting} 
        formatDate={formatDate}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
        tenantId={tenantId}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default ReunioesTab;
