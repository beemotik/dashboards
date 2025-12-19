import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useMeetings } from '@/hooks/useMeetings';
import FilterBar from '@/components/FilterBar';
import { 
  Users, 
  AlertCircle, 
  Search, 
  Calendar, 
  Clock, 
  FileText, 
  Star,
  Brain,
  Ear,
  Heart,
  Target,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Mic,
  BarChart2,
  Download
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// Advanced Tenant Mapping Configuration
const TENANT_CONFIG = {
  '1746648297278x228824935168213000': {
    options: ['cacau-cristian-001'],
    defaultOption: 'cacau-cristian-001',
    lock: true
  },
  '1746042759022x580092293537857500': {
    options: ['sanduba'],
    defaultOption: 'sanduba',
    lock: true
  },
  '1754578523842x310706497185120260': {
    options: [
      'divino-fogão-lojas-proprias',
      'divino-fogão-fora-de-sp',
      'divino-fogão-dentro-de-sp'
    ],
    defaultOption: 'divino-fogão-lojas-proprias',
    lock: false
  }
};

const fetchAllCompanyNames = async (tenantId) => {
  try {
    const url = `https://n8n.beemotik.com/webhook/reunioesdatameet?tenantId=${tenantId}&from=2000-01-01&to=2099-12-31`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error fetching company names: ${response.status}`);
      return [];
    }
    const data = await response.json();
    const companyNames = [...new Set(data.map(m => m.companyName).filter(Boolean))];
    return companyNames.sort();
  } catch (error) {
    console.error('Failed to fetch all company names:', error);
    return [];
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const getParticipantName = (participants) => {
  if (Array.isArray(participants) && participants.length > 0) {
    return participants[0].name || participants[0].email || 'N/A';
  } else if (typeof participants === 'string') {
    return participants;
  }
  return 'N/A';
};

const ScoreBadge = ({ score }) => {
  const numScore = parseFloat(score);
  let colorClass = "bg-gray-500";
  if (!isNaN(numScore)) {
    if (numScore >= 8) colorClass = "bg-green-500";
    else if (numScore >= 5) colorClass = "bg-yellow-500";
    else colorClass = "bg-red-500";
  }

  return (
    <span className={cn("inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white", colorClass)}>
      {score ?? 'N/A'}
    </span>
  );
};

const ConsultoresDashboard = () => {
  const { tenantId, companyName: contextCompanyName, isAdmin } = useAppContext();
  const { toast } = useToast();
  
  // State for company dropdown logic
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [isDropdownLocked, setIsDropdownLocked] = useState(false);

  // Default date range to last 7 days
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    return {
      from: lastWeek.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  });

  const [filters, setFilters] = useState({
    companyName: '',
    storeName: 'ALL',
    auditor: 'ALL',
    status: 'Todas',
    from: dateRange.from,
    to: dateRange.to,
    tenantId: tenantId
  });

  const [appliedFilters, setAppliedFilters] = useState({
    companyName: '',
    storeName: 'ALL',
    auditor: 'ALL',
    status: 'Todas',
    from: '',
    to: '',
    tenantId: tenantId
  });

  const [selectedConsultantData, setSelectedConsultantData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Sync date range state with filters
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      from: dateRange.from,
      to: dateRange.to
    }));
  }, [dateRange]);

  // Sync context tenant changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, tenantId: tenantId }));
  }, [tenantId]);

  // Company Loading Logic
  useEffect(() => {
    const initCompanies = async () => {
      setCompaniesLoading(true);

      const tenantConfig = TENANT_CONFIG[tenantId];

      if (tenantConfig) {
        setAvailableCompanies(tenantConfig.options);
        setIsDropdownLocked(tenantConfig.lock);
        
        if (!filters.companyName || !tenantConfig.options.includes(filters.companyName)) {
           const defaultComp = tenantConfig.defaultOption;
           setFilters(prev => ({ ...prev, companyName: defaultComp }));
           if (dateRange.from && dateRange.to) {
             setAppliedFilters(prev => ({
               ...prev,
               tenantId: tenantId,
               companyName: defaultComp,
               from: dateRange.from,
               to: dateRange.to
             }));
           }
        }
      } else {
        const companies = await fetchAllCompanyNames(tenantId);
        setAvailableCompanies(companies);
        setIsDropdownLocked(companies.length <= 1);
        
        let autoFill = '';
        if (contextCompanyName && companies.includes(contextCompanyName)) {
          autoFill = contextCompanyName;
        } else if (companies.length === 1) {
          autoFill = companies[0];
        }

        if (autoFill) {
           setFilters(prev => ({ ...prev, companyName: autoFill }));
           if (dateRange.from && dateRange.to) {
             setAppliedFilters(prev => ({
               ...prev,
               tenantId: tenantId,
               companyName: autoFill,
               from: dateRange.from,
               to: dateRange.to
             }));
           }
        }
      }
      setCompaniesLoading(false);
    };

    if (tenantId) {
      initCompanies();
    }
  }, [tenantId, contextCompanyName]);

  const { meetings, loading, error } = useMeetings(appliedFilters);

  // Sort meetings by startMoment descending
  const sortedMeetings = useMemo(() => {
    if (!meetings) return [];
    return [...meetings]
      .sort((a, b) => new Date(b.startMoment || b.date) - new Date(a.startMoment || a.date))
      .slice(0, 2000); // Limit to 2000 rows as requested
  }, [meetings]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };
  
  const handleApplyFilters = () => {
    if (filters.companyName && filters.from && filters.to) {
      setAppliedFilters(filters);
    }
  };

  const handleRowClick = (meeting) => {
    setSelectedConsultantData({
      ...meeting.consultor,
      auditorName: meeting.auditor?.name || 'Consultor',
      storeName: meeting.storeName,
      date: meeting.startMoment || meeting.date,
      transcricao: meeting.transcription || meeting.transcricao // Handle potential field name variations
    });
    setModalOpen(true);
  };

  const handleDownloadTranscription = () => {
    if (!selectedConsultantData || !selectedConsultantData.transcricao) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Transcrição não disponível para download."
      });
      return;
    }

    const element = document.createElement("a");
    const file = new Blob([selectedConsultantData.transcricao], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    
    // Filename format: "transcrição_[storeName]_[date].txt"
    const safeStoreName = (selectedConsultantData.storeName || 'Loja').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeDate = (selectedConsultantData.date || new Date().toISOString()).replace(/[^a-z0-9]/gi, '_');
    
    element.download = `transcricao_${safeStoreName}_${safeDate}.txt`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Sucesso",
      description: "Download da transcrição iniciado."
    });
  };

  const hasAppliedFilters = appliedFilters.companyName && appliedFilters.from && appliedFilters.to;

  return (
    <div className="p-6 h-screen flex flex-col overflow-hidden bg-[#1B1B1B]">
      <div className="flex-shrink-0 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-domine font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-[#E8B930]" />
              Consultores - Análise de Reuniões
            </h1>
            <p className="text-sm text-gray-400 mt-1">Visão detalhada das reuniões e performance dos consultores</p>
          </div>
        </div>

        <FilterBar 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          onApply={handleApplyFilters}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          meetings={meetings} 
          availableCompanies={availableCompanies}
          companiesLoading={companiesLoading}
          isDropdownLocked={isDropdownLocked}
        />
      </div>
      
      {!hasAppliedFilters ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-[#3C4144] rounded-xl bg-[#252525] p-8 text-center animate-in fade-in zoom-in-95 duration-300 mx-6 mb-6">
          <div className="bg-[#33393D] p-4 rounded-full mb-4">
            <Search className="w-10 h-10 text-[#E8B930]" />
          </div>
          <h2 className="text-xl font-domine font-bold text-white mb-2">Selecione uma Empresa</h2>
          <p className="text-gray-400 max-w-md">
            Para visualizar os dados das reuniões, por favor selecione uma empresa e período no filtro acima e clique em filtrar.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 pb-6">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-md flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>Erro ao carregar dados: {error}</span>
            </div>
          )}
          
          <div className="h-full bg-[#252525] border border-[#3C4144] rounded-xl overflow-hidden flex flex-col">
             <div className="p-4 border-b border-[#3C4144] bg-[#2F2F2F] flex justify-between items-center">
                <h3 className="font-domine font-bold text-white text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#E8B930]" />
                  Reuniões ({sortedMeetings.length})
                </h3>
             </div>
             
             <div className="flex-1 overflow-auto custom-scrollbar">
                <Table>
                  <TableHeader className="bg-[#33393D] sticky top-0 z-10">
                    <TableRow className="border-b-[#4C4E50] hover:bg-[#33393D]">
                      <TableHead className="text-gray-300 font-bold uppercase text-xs w-[200px]">Loja</TableHead>
                      <TableHead className="text-gray-300 font-bold uppercase text-xs">Data e Hora</TableHead>
                      <TableHead className="text-gray-300 font-bold uppercase text-xs">Participantes</TableHead>
                      <TableHead className="text-gray-300 font-bold uppercase text-xs">Duração</TableHead>
                      <TableHead className="text-gray-300 font-bold uppercase text-xs">Consultor</TableHead>
                      <TableHead className="text-gray-300 font-bold uppercase text-xs text-center">Nota</TableHead>
                      <TableHead className="text-gray-300 font-bold uppercase text-xs text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                           Carregando reuniões...
                        </TableCell>
                      </TableRow>
                    ) : sortedMeetings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                           Nenhuma reunião encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedMeetings.map((meeting, index) => (
                        <TableRow 
                          key={index} 
                          className="border-b-[#3C4144] hover:bg-[#2F2F2F] cursor-pointer transition-colors group"
                          onClick={() => handleRowClick(meeting)}
                        >
                          <TableCell className="font-medium text-white">{meeting.storeName}</TableCell>
                          <TableCell className="text-gray-300 flex items-center gap-2">
                             <Calendar className="w-4 h-4 text-gray-500" />
                             {formatDate(meeting.startMoment || meeting.date)}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {getParticipantName(meeting.participants)}
                          </TableCell>
                          <TableCell className="text-gray-300">
                             {meeting.durationMinutes 
                               ? `${meeting.durationMinutes} min` 
                               : (meeting.duration ? `${Math.floor(meeting.duration / 60)} min` : '-')}
                          </TableCell>
                          <TableCell className="text-gray-300">
                             {meeting.auditor?.name || 'N/A'}
                          </TableCell>
                          <TableCell className="text-center">
                            <ScoreBadge score={meeting.consultor?.nota_geral} />
                          </TableCell>
                          <TableCell className="text-right">
                             <Button size="sm" variant="ghost" className="text-[#E8B930] hover:text-[#E8B930] hover:bg-[#E8B930]/10">
                                Ver Análise
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
             </div>
          </div>
        </div>
      )}

      {/* Consultant Analysis Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl bg-[#1B1B1B] border-[#3C4144] text-white h-[90vh] p-0 flex flex-col gap-0">
          <DialogHeader className="p-6 border-b border-[#3C4144] bg-[#2F2F2F] flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-domine text-white flex items-center gap-3">
                <Brain className="w-8 h-8 text-[#E8B930]" />
                Análise do Consultor
              </DialogTitle>
              <DialogDescription className="text-gray-400 flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1"><Users className="w-4 h-4"/> {selectedConsultantData?.auditorName}</span>
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {formatDate(selectedConsultantData?.date)}</span>
                <span className="flex items-center gap-1"><Target className="w-4 h-4"/> {selectedConsultantData?.storeName}</span>
              </DialogDescription>
            </div>
            
            {/* Transcription Download Button */}
            {selectedConsultantData?.transcricao && (
              <Button 
                onClick={handleDownloadTranscription}
                variant="outline"
                className="border-[#E8B930] text-[#E8B930] hover:bg-[#E8B930] hover:text-black mr-8"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar Transcrição
              </Button>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            {!selectedConsultantData || !selectedConsultantData.nota_geral ? (
               <div className="flex flex-col items-center justify-center h-64 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-600 mb-4" />
                  <p className="text-gray-400 text-lg">Análise detalhada não disponível para esta reunião.</p>
               </div>
            ) : (
              <div className="space-y-8">
                {/* 1. Score Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   <MetricCard 
                      title="Nota Geral" 
                      score={selectedConsultantData.nota_geral} 
                      icon={Star}
                      className="bg-gradient-to-br from-[#2F2F2F] to-[#252525] border-[#E8B930]/50 border-2"
                      showJustification={false}
                   />
                   <MetricCard 
                      title="Clareza na Comunicação" 
                      score={selectedConsultantData.clareza_na_comunicacao?.nota} 
                      justification={selectedConsultantData.clareza_na_comunicacao?.justificativa}
                      icon={MessageCircle}
                   />
                   <MetricCard 
                      title="Escuta Ativa" 
                      score={selectedConsultantData.escuta_ativa?.nota} 
                      justification={selectedConsultantData.escuta_ativa?.justificativa}
                      icon={Ear}
                   />
                   <MetricCard 
                      title="Empatia" 
                      score={selectedConsultantData.empatia?.nota} 
                      justification={selectedConsultantData.empatia?.justificativa}
                      icon={Heart}
                   />
                   <MetricCard 
                      title="Capacidade de Aprofundamento" 
                      score={selectedConsultantData.capacidade_de_aprofundamento?.nota} 
                      justification={selectedConsultantData.capacidade_de_aprofundamento?.justificativa}
                      icon={Brain}
                   />
                   <MetricCard 
                      title="Organização e Fechamento" 
                      score={selectedConsultantData.organizacao_e_fechamento?.nota} 
                      justification={selectedConsultantData.organizacao_e_fechamento?.justificativa}
                      icon={CheckCircle2}
                   />
                </div>

                {/* 2. Strengths & Improvements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <Card className="bg-[#252525] border-[#3C4144] border-l-4 border-l-green-500">
                      <CardContent className="p-6">
                         <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                           <CheckCircle2 className="w-5 h-5 text-green-500" />
                           Pontos Fortes
                         </h3>
                         <ul className="space-y-2">
                            {selectedConsultantData.pontos_fortes?.map((point, i) => (
                               <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></span>
                                  {point}
                               </li>
                            )) || <li className="text-gray-500 italic">Nenhum ponto registrado.</li>}
                         </ul>
                      </CardContent>
                   </Card>

                   <Card className="bg-[#252525] border-[#3C4144] border-l-4 border-l-red-500">
                      <CardContent className="p-6">
                         <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                           <Target className="w-5 h-5 text-red-500" />
                           Pontos de Melhoria
                         </h3>
                         <ul className="space-y-2">
                            {selectedConsultantData.pontos_de_melhoria?.map((point, i) => (
                               <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></span>
                                  {point}
                               </li>
                            )) || <li className="text-gray-500 italic">Nenhum ponto registrado.</li>}
                         </ul>
                      </CardContent>
                   </Card>
                </div>

                {/* 3. Qualitative Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="md:col-span-1 bg-[#2F2F2F] p-4 rounded-lg border border-[#3C4144]">
                      <h4 className="text-[#E8B930] font-bold text-sm uppercase mb-2 flex items-center gap-2">
                        <Mic className="w-4 h-4" /> Tom de Voz
                      </h4>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {selectedConsultantData.tom_de_voz || "Não analisado."}
                      </p>
                   </div>
                   <div className="md:col-span-1 bg-[#2F2F2F] p-4 rounded-lg border border-[#3C4144]">
                      <h4 className="text-[#E8B930] font-bold text-sm uppercase mb-2 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" /> Linguagem
                      </h4>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {selectedConsultantData.linguagem || "Não analisado."}
                      </p>
                   </div>
                   <div className="md:col-span-1 bg-[#2F2F2F] p-4 rounded-lg border border-[#3C4144]">
                      <h4 className="text-[#E8B930] font-bold text-sm uppercase mb-2 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" /> Condução
                      </h4>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {selectedConsultantData.conducao || "Não analisado."}
                      </p>
                   </div>
                </div>

                {/* 4. DISC Profile */}
                <div className="bg-[#252525] border border-[#3C4144] rounded-xl p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8B930]/10 rounded-bl-full -mr-8 -mt-8"></div>
                   
                   <h3 className="text-lg font-bold text-white mb-4 relative z-10">Perfil DISC Identificado</h3>
                   
                   <div className="flex flex-col md:flex-row gap-6 relative z-10">
                      <div className="bg-[#33393D] p-6 rounded-lg text-center min-w-[150px] flex flex-col items-center justify-center border border-[#4C4E50]">
                         <span className="text-4xl font-extrabold text-[#E8B930] block mb-2">
                           {selectedConsultantData.perfil_disc_tipo || "?"}
                         </span>
                         <span className="text-xs uppercase text-gray-400 font-bold tracking-wider">Tipo Predominante</span>
                      </div>
                      
                      <div className="flex-1">
                         <h4 className="text-sm font-bold text-gray-300 mb-2 uppercase">Análise Comportamental</h4>
                         <p className="text-gray-400 text-sm leading-relaxed">
                           {selectedConsultantData.perfil_disc_justificativa || "Análise de perfil não disponível."}
                         </p>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 border-t border-[#3C4144] bg-[#2F2F2F]">
            <Button 
               variant="outline" 
               onClick={() => setModalOpen(false)}
               className="border-[#4C4E50] text-gray-300 hover:bg-[#3C4144] hover:text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MetricCard = ({ title, score, justification, icon: Icon, className, showJustification = true }) => (
  <Card className={cn("bg-[#252525] border-[#3C4144] overflow-hidden flex flex-col", className)}>
    <div className="p-4 flex items-start justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <span className="text-sm font-medium text-gray-200">{title}</span>
      </div>
      <ScoreBadge score={score} />
    </div>
    {showJustification && (
      <div className="px-4 pb-4 flex-1">
        <p className="text-xs text-gray-400 leading-relaxed border-t border-[#3C4144] pt-2 mt-1">
          {justification || "Sem justificativa."}
        </p>
      </div>
    )}
  </Card>
);

export default ConsultoresDashboard;