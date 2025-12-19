
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAppContext } from '@/context/AppContext';
import { 
  Filter, 
  AlertCircle, 
  Search, 
  MessageCircle, 
  ChevronRight, 
  ChevronLeft,
  Calendar,
  User,
  Clock,
  MessageSquare,
  HelpCircle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

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
    // Last day of current month (or today if we want up to now, usually just today is fine for 'to')
    // Let's set 'to' as today to avoid future dates being default, but 'from' as 1st of month.
    
    // Format to YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];

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
      
      // If we are not admin, filter by tenant_id (unless tenant_id matches master, but usually good practice)
      // Note: The context tenantId might be the master tenant, or specific company tenant. 
      // If the user selects a company, we filter by that company name.
      // Usually we also filter by tenant_id column if present to be safe, but 'empresa' name is the primary filter in this UI.
      // query = query.eq('tenant_id', tenantId); 

      const { data, error } = await query;

      if (error) throw error;

      // Group by thread_id, keep latest
      // The query returns ordered by created_at DESC, so the first occurrence of a thread_id is the latest event.
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

  // Pagination
  const totalPages = Math.ceil(tickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = tickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      // Adjust for timezone if needed, or just use UTC date string part
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
        <Card className="bg-[#252525] border-[#3C4144] shadow-xl">
          <CardHeader className="border-b border-[#3C4144] pb-4">
             <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-domine text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-[#E8B930]" /> Tickets SAC
                </CardTitle>
                <div className="text-sm text-gray-400">Total: {tickets.length}</div>
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
