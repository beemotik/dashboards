
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAppContext } from '@/context/AppContext';
import { 
  Filter, 
  AlertCircle, 
  MessageCircle, 
  ChevronRight, 
  ChevronLeft,
  Clock,
  HelpCircle,
  FileText,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  CheckCircle2,
  Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts';

const COLORS = ['#E8B930', '#22c55e', '#ef4444', '#3b82f6', '#a855f7', '#f97316', '#64748b'];

const SACTab = () => {
  const { tenantId, companyName: contextCompanyName, isAdmin } = useAppContext();
  
  // State for Filters
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({
    empresa: '',
    from: '',
    to: '',
    canal: 'all',
    tipo: 'all',
    status: 'all'
  });

  // State for Data
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [distinctTypes, setDistinctTypes] = useState([]);
  const [distinctStatuses, setDistinctStatuses] = useState([]);

  // State for Drawer/Details
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Initialize Dates (Current Month)
  useEffect(() => {
    const today = new Date();
    // First day of current month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format to YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setFilters(prev => ({
      ...prev,
      to: formatDate(today),
      from: formatDate(firstDay)
    }));
  }, []);

  // Fetch Companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresas')
          .select('Name, nome, name')
          .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
          .single();

        let myCompanyName = '';
        if (!empresaError && empresaData) {
          myCompanyName = empresaData.Name || empresaData.nome || empresaData.name || '';
        } else {
          myCompanyName = contextCompanyName || '';
        }

        if (isAdmin) {
          const { data: allCompaniesData } = await supabase
            .from('sac_events')
            .select('empresa')
            .not('empresa', 'is', null);

          if (allCompaniesData) {
            const uniqueCompanies = [...new Set(allCompaniesData.map(c => c.empresa))]
              .filter(c => c && c.trim() !== '')
              .sort();
            setCompanies(uniqueCompanies);
            
            if (myCompanyName && uniqueCompanies.includes(myCompanyName)) {
               setFilters(prev => ({ ...prev, empresa: myCompanyName }));
            }
          }
        } else {
          if (myCompanyName) {
            setCompanies([myCompanyName]);
            setFilters(prev => ({ ...prev, empresa: myCompanyName }));
          }
        }
      } catch (err) {
        console.error("Error fetching companies:", err);
      }
    };
    fetchCompanies();
  }, [tenantId, contextCompanyName, isAdmin]);

  // Fetch Distinct Types and Statuses when Company changes
  useEffect(() => {
    const fetchOptions = async () => {
      if (!filters.empresa) return;

      const { data } = await supabase
        .from('sac_events')
        .select('tipo, ticket_status')
        .eq('empresa', filters.empresa)
        .order('created_at', { ascending: false })
        .limit(500);

      if (data) {
        const types = [...new Set(data.map(i => i.tipo).filter(Boolean))].sort();
        const statuses = [...new Set(data.map(i => i.ticket_status).filter(Boolean))].sort();
        setDistinctTypes(types);
        setDistinctStatuses(statuses);
      }
    };
    fetchOptions();
  }, [filters.empresa]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = async () => {
    if (!filters.empresa) return;
    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    
    try {
      // Base query
      let query = supabase
        .from('sac_events')
        .select('*')
        .eq('empresa', filters.empresa)
        .gte('created_at', `${filters.from}T00:00:00`)
        .lte('created_at', `${filters.to}T23:59:59`)
        .order('created_at', { ascending: false }); // Get newest first

      // Apply filters if not 'all'
      if (filters.canal !== 'all') query = query.eq('canal', filters.canal);
      if (filters.tipo !== 'all') query = query.eq('tipo', filters.tipo);
      if (filters.status !== 'all') query = query.eq('ticket_status', filters.status);
      
      const { data, error } = await query;

      if (error) throw error;

      // Group by thread_id, keep latest
      const threadsMap = new Map();
      
      (data || []).forEach(event => {
        if (!event.thread_id) return;
        // Only add if not already present (since we want the first one = latest)
        if (!threadsMap.has(event.thread_id)) {
          threadsMap.set(event.thread_id, event);
        }
      });

      const groupedTickets = Array.from(threadsMap.values());
      setTickets(groupedTickets);

    } catch (error) {
      console.error('Error fetching SAC tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);
    setDetailOpen(true);
    setMessagesLoading(true);
    setTicketMessages([]);
    
    try {
      // Fetch all messages for this thread
      const { data, error } = await supabase
        .from('sac_events')
        .select('*')
        .eq('thread_id', ticket.thread_id)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setTicketMessages(data || []);
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setMessagesLoading(false);
    }
  };

  // --- Executive Dashboard Data Calculations ---
  const dashboardData = useMemo(() => {
    if (!tickets.length) return null;

    let total = 0;
    let reclamacoes = 0;
    let elogios = 0;
    let duvidas = 0; // Includes 'duvida' and others not reclamacao/elogio
    let abertos = 0;
    
    const canalStats = {}; // { canalName: { total: 0, reclamacoes: 0, ratingSum: 0, ratingCount: 0 } }
    const statusStats = {}; // { statusName: count }

    const openStatuses = ['novo', 'em_andamento', 'aguardando_cliente'];

    tickets.forEach(t => {
      total++;
      const tipo = (t.tipo || '').toLowerCase();
      const status = (t.ticket_status || 'indefinido').toLowerCase();
      const canal = (t.canal || 'outros').toLowerCase();
      const nota = t.nota ? parseFloat(t.nota) : null;

      // Big Numbers
      if (tipo === 'reclamacao' || tipo === 'reclamação') {
        reclamacoes++;
      } else if (tipo === 'elogio') {
        elogios++;
      } else {
        duvidas++;
      }

      if (openStatuses.includes(status) || status === 'open' || status.includes('pending')) {
        abertos++;
      }

      // Channel Stats
      if (!canalStats[canal]) {
        canalStats[canal] = { total: 0, reclamacoes: 0, ratingSum: 0, ratingCount: 0 };
      }
      canalStats[canal].total++;
      if (tipo === 'reclamacao' || tipo === 'reclamação') {
        canalStats[canal].reclamacoes++;
      }
      if (nota !== null && !isNaN(nota)) {
        canalStats[canal].ratingSum += nota;
        canalStats[canal].ratingCount++;
      }

      // Status Stats
      if (!statusStats[status]) {
        statusStats[status] = 0;
      }
      statusStats[status]++;
    });

    // Transform for Charts
    const chartTicketsByCanal = Object.keys(canalStats).map(c => ({
      name: c.charAt(0).toUpperCase() + c.slice(1),
      value: canalStats[c].total
    })).sort((a, b) => b.value - a.value);

    const chartComplaintsByCanal = Object.keys(canalStats).map(c => ({
      name: c.charAt(0).toUpperCase() + c.slice(1),
      value: canalStats[c].reclamacoes
    })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

    const chartAvgRatingByCanal = Object.keys(canalStats).map(c => {
       const stat = canalStats[c];
       const avg = stat.ratingCount > 0 ? (stat.ratingSum / stat.ratingCount) : 0;
       return {
         name: c.charAt(0).toUpperCase() + c.slice(1),
         value: parseFloat(avg.toFixed(1))
       };
    }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

    const chartStatus = Object.keys(statusStats).map(s => ({
      name: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: statusStats[s]
    })).sort((a, b) => b.value - a.value);

    return {
      total,
      reclamacoes,
      elogios,
      duvidas,
      abertos,
      chartTicketsByCanal,
      chartComplaintsByCanal,
      chartAvgRatingByCanal,
      chartStatus
    };
  }, [tickets]);

  // Pagination
  const totalPages = Math.ceil(tickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = tickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch { return dateString; }
  };
  
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    } catch { return dateString; }
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('fechado') || s.includes('resolvido') || s === 'closed') return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (s.includes('aberto') || s === 'open') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    if (s.includes('pendente')) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const canalOptions = [
    { value: 'all', label: 'Todos os Canais' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'email', label: 'Email' },
    { value: 'site', label: 'Site' },
    { value: 'google_business', label: 'Google Business' }
  ];

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#2F2F2F] border border-[#4C4E50] p-2 rounded shadow-lg">
          <p className="text-white font-bold text-sm">{label}</p>
          <p className="text-[#E8B930] text-sm">
            {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-full p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-domine font-bold text-[#E8B930]">SAC</h1>
        <p className="text-gray-400 text-sm">Gerenciamento de Atendimento ao Cliente</p>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#2F2F2F] border border-[#3C4144] rounded-xl p-6 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          
          {/* Empresa */}
          <div className="space-y-2 lg:col-span-1">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Empresa <span className="text-red-500">*</span></Label>
            <Select 
              value={filters.empresa} 
              onValueChange={(val) => handleFilterChange('empresa', val)}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                {companies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Período <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                className="bg-[#33393D] border-[#4C4E50] text-white h-10"
              />
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                className="bg-[#33393D] border-[#4C4E50] text-white h-10"
              />
            </div>
          </div>

          {/* Canal */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Canal</Label>
            <Select 
              value={filters.canal} 
              onValueChange={(val) => handleFilterChange('canal', val)}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                {canalOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Tipo</Label>
            <Select 
              value={filters.tipo} 
              onValueChange={(val) => handleFilterChange('tipo', val)}
              disabled={distinctTypes.length === 0}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                <SelectItem value="all">Todos</SelectItem>
                {distinctTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Status</Label>
            <Select 
              value={filters.status} 
              onValueChange={(val) => handleFilterChange('status', val)}
              disabled={distinctStatuses.length === 0}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                <SelectItem value="all">Todos</SelectItem>
                {distinctStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        <div className="mt-4 flex justify-end">
           <Button 
              onClick={handleSearch}
              disabled={!filters.empresa || !filters.from || !filters.to || loading}
              className="bg-[#E8B930] hover:bg-[#d1a525] text-black font-bold h-10 w-full lg:w-auto min-w-[200px]"
            >
              <Filter className="w-4 h-4 mr-2" />
              {loading ? 'Carregando...' : 'Filtrar Dados'}
            </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {!hasSearched ? (
        <div className="flex flex-col items-center justify-center h-[400px] border border-[#3C4144] rounded-xl bg-[#252525] p-8 text-center">
          <div className="bg-[#33393D] p-6 rounded-full mb-6">
            <AlertCircle className="w-12 h-12 text-[#E8B930]" />
          </div>
          <h2 className="text-2xl font-domine font-bold text-white mb-2">Selecione os Filtros</h2>
          <p className="text-gray-400 max-w-md">
            Para visualizar o SAC, selecione uma Empresa e um Período e clique em "Filtrar".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Executive Dashboard (Painel Executivo) */}
          {dashboardData && (
             <div className="space-y-6 animate-in fade-in-50 duration-500">
                <h2 className="text-xl font-domine font-bold text-white border-l-4 border-[#E8B930] pl-3">Painel Executivo</h2>
                
                {/* Big Numbers Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="bg-[#252525] border-[#3C4144]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-400">Total de Tickets</CardTitle>
                      <Inbox className="h-4 w-4 text-[#E8B930]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{dashboardData.total}</div>
                      <p className="text-xs text-gray-500">Atendimentos no período</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#252525] border-[#3C4144]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-400">Reclamações</CardTitle>
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{dashboardData.reclamacoes}</div>
                      <Badge variant="outline" className="mt-1 bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">
                        Crítico
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#252525] border-[#3C4144]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-400">Elogios</CardTitle>
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{dashboardData.elogios}</div>
                      <p className="text-xs text-green-500/80">Feedbacks positivos</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#252525] border-[#3C4144]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-400">Dúvidas / Outros</CardTitle>
                      <HelpCircle className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{dashboardData.duvidas}</div>
                      <p className="text-xs text-gray-500">Geral</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#252525] border-[#3C4144]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-400">Tickets Abertos</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{dashboardData.abertos}</div>
                      <p className="text-xs text-orange-500">Pendentes de ação</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {/* Chart 1: Tickets per Channel */}
                   <Card className="bg-[#252525] border-[#3C4144]">
                      <CardHeader>
                         <CardTitle className="text-base text-white">Tickets por Canal</CardTitle>
                         <CardDescription className="text-xs text-gray-400">Volume de atendimento por origem</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.chartTicketsByCanal} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                               <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                               <XAxis type="number" stroke="#666" fontSize={12} />
                               <YAxis dataKey="name" type="category" stroke="#999" fontSize={12} width={80} />
                               <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                               <Bar dataKey="value" fill="#E8B930" radius={[0, 4, 4, 0]} barSize={30}>
                                  <LabelList dataKey="value" position="right" fill="#fff" fontSize={12} />
                               </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                      </CardContent>
                   </Card>

                   {/* Chart 2: Complaints per Channel */}
                   <Card className="bg-[#252525] border-[#3C4144]">
                      <CardHeader>
                         <CardTitle className="text-base text-white">Reclamações por Canal</CardTitle>
                         <CardDescription className="text-xs text-gray-400">Foco de problemas por canal</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                        {dashboardData.chartComplaintsByCanal.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dashboardData.chartComplaintsByCanal} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                 <XAxis dataKey="name" stroke="#666" fontSize={12} />
                                 <YAxis stroke="#666" fontSize={12} />
                                 <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                                 <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40}>
                                    <LabelList dataKey="value" position="top" fill="#fff" fontSize={12} />
                                 </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                              Nenhuma reclamação registrada no período.
                           </div>
                        )}
                      </CardContent>
                   </Card>

                   {/* Chart 3: Avg Rating per Channel */}
                   <Card className="bg-[#252525] border-[#3C4144]">
                      <CardHeader>
                         <CardTitle className="text-base text-white">Média de Nota por Canal</CardTitle>
                         <CardDescription className="text-xs text-gray-400">Avaliação média (0-10 ou 1-5)</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                        {dashboardData.chartAvgRatingByCanal.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dashboardData.chartAvgRatingByCanal} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                 <XAxis dataKey="name" stroke="#666" fontSize={12} />
                                 <YAxis stroke="#666" fontSize={12} domain={[0, 'auto']} />
                                 <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                                 <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                                    <LabelList dataKey="value" position="top" fill="#fff" fontSize={12} />
                                 </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                              Nenhuma avaliação com nota registrada.
                           </div>
                        )}
                      </CardContent>
                   </Card>

                   {/* Chart 4: Ticket Status */}
                   <Card className="bg-[#252525] border-[#3C4144]">
                      <CardHeader>
                         <CardTitle className="text-base text-white">Status dos Tickets</CardTitle>
                         <CardDescription className="text-xs text-gray-400">Distribuição por estado atual</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie
                                  data={dashboardData.chartStatus}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                               >
                                  {dashboardData.chartStatus.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                               </Pie>
                               <Tooltip content={<CustomTooltip />} />
                               <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                         </ResponsiveContainer>
                      </CardContent>
                   </Card>
                </div>
             </div>
          )}

          {/* List Section */}
          <Card className="bg-[#252525] border-[#3C4144] shadow-xl">
            <CardHeader className="border-b border-[#3C4144] pb-4">
               <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-domine text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-[#E8B930]" /> Listagem de Tickets
                  </CardTitle>
                  <div className="text-sm text-gray-400">Mostrando {paginatedTickets.length} de {tickets.length}</div>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                  <TableHeader className="bg-[#2F2F2F]">
                     <TableRow className="border-b-[#3C4144] hover:bg-[#2F2F2F]">
                        <TableHead className="text-gray-400 font-bold">Canal</TableHead>
                        <TableHead className="text-gray-400 font-bold">Cliente</TableHead>
                        <TableHead className="text-gray-400 font-bold">Tipo</TableHead>
                        <TableHead className="text-gray-400 font-bold">Status</TableHead>
                        <TableHead className="text-gray-400 font-bold">Nota</TableHead>
                        <TableHead className="text-gray-400 font-bold">Resumo</TableHead>
                        <TableHead className="text-gray-400 font-bold text-right">Data</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {paginatedTickets.length === 0 ? (
                        <TableRow>
                           <TableCell colSpan={7} className="text-center py-12 text-gray-500">Nenhum ticket encontrado.</TableCell>
                        </TableRow>
                     ) : (
                        paginatedTickets.map((ticket, idx) => (
                           <TableRow 
                              key={idx} 
                              onClick={() => handleTicketClick(ticket)}
                              className="border-b-[#3C4144] hover:bg-[#2F2F2F] cursor-pointer transition-colors"
                           >
                              <TableCell className="text-gray-300 font-medium capitalize">{ticket.canal}</TableCell>
                              <TableCell className="text-white">
                                 <div className="flex flex-col">
                                    <span>{ticket.autor_nome || 'Anônimo'}</span>
                                    <span className="text-xs text-gray-500">{ticket.autor_contato}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-gray-300">{ticket.tipo || '-'}</TableCell>
                              <TableCell>
                                 <Badge className={getStatusColor(ticket.ticket_status)}>
                                    {ticket.ticket_status || 'N/A'}
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-gray-300 font-mono">{ticket.nota || '—'}</TableCell>
                              <TableCell className="text-gray-400 max-w-[300px] truncate" title={ticket.text}>
                                 {ticket.text || '-'}
                              </TableCell>
                              <TableCell className="text-right text-gray-300">{formatDate(ticket.created_at)}</TableCell>
                           </TableRow>
                        ))
                     )}
                  </TableBody>
               </Table>

               {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-[#3C4144] flex items-center justify-between bg-[#2F2F2F]">
                  <span className="text-xs text-gray-500">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0 border-[#4C4E50] bg-[#252525] text-gray-300 hover:bg-[#33393D] hover:text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
        </div>
      )}

      {/* Detail Drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
         <DialogContent className="bg-[#1B1B1B] border-[#3C4144] text-white max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-6 border-b border-[#3C4144]">
               <DialogTitle className="font-domine text-xl text-[#E8B930] flex items-center gap-2">
                  <HelpCircle className="w-5 h-5"/> Detalhes do Atendimento
               </DialogTitle>
               {selectedTicket && (
                  <DialogDescription className="text-gray-400 mt-1 flex items-center gap-2">
                     <span className="bg-[#33393D] px-2 py-0.5 rounded text-xs text-white">{selectedTicket.thread_id}</span>
                     <span>•</span>
                     <span className="capitalize">{selectedTicket.canal}</span>
                  </DialogDescription>
               )}
            </DialogHeader>

            <ScrollArea className="flex-1 p-6">
               {messagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                     <Skeleton className="w-3/4 h-20 bg-[#33393D]" />
                     <Skeleton className="w-2/3 h-16 bg-[#33393D]" />
                     <Skeleton className="w-3/4 h-24 bg-[#33393D]" />
                  </div>
               ) : (
                  <div className="space-y-6">
                     {ticketMessages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.role === 'assistant' || msg.role === 'system' ? 'items-end' : 'items-start'}`}>
                           <div className={`
                              max-w-[85%] rounded-lg p-4 border
                              ${msg.role === 'assistant' || msg.role === 'system'
                                 ? 'bg-[#33393D] border-[#4C4E50] text-gray-100 rounded-tr-none' 
                                 : 'bg-[#252525] border-[#3C4144] text-gray-200 rounded-tl-none'}
                           `}>
                              <div className="flex items-center justify-between gap-4 mb-2 border-b border-white/5 pb-2">
                                 <span className="text-xs font-bold text-[#E8B930] uppercase tracking-wider">
                                    {msg.role === 'assistant' ? 'Atendente' : (msg.autor_nome || 'Cliente')}
                                 </span>
                                 <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3"/> {formatDateTime(msg.created_at)}
                                 </span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                 {msg.text}
                              </p>
                              {msg.media_url && (
                                <div className="mt-2">
                                   <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-[#E8B930] hover:underline text-xs flex items-center gap-1">
                                      <FileText className="w-3 h-3"/> Ver Anexo
                                   </a>
                                </div>
                              )}
                              <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                                 <span className="text-[10px] text-gray-600 uppercase">{msg.canal}</span>
                                 {msg.nota && <span className="text-[10px] bg-yellow-900/30 text-yellow-500 px-1 rounded">Nota: {msg.nota}</span>}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </ScrollArea>

            <DialogFooter className="p-4 border-t border-[#3C4144] bg-[#252525]">
               <Button onClick={() => setDetailOpen(false)} className="bg-[#3C4144] hover:bg-[#4C4E50] text-white w-full sm:w-auto">
                  Fechar
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
};

export default SACTab;
