
import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, Download, Trash2, AlertTriangle, Save, Loader2, XCircle, ChevronLeft, ChevronRight, Check, Edit2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const EvaluationDetailModal = ({ isOpen, onClose, evaluation, currentIndex, totalCount, onNext, onPrev, onSave }) => {
  const [editedScore, setEditedScore] = useState(evaluation?.score ?? '');
  const [editedComment, setEditedComment] = useState(evaluation?.comment ?? '');
  
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);

  useEffect(() => {
    if (evaluation) {
      setEditedScore(evaluation.score ?? '');
      setEditedComment(evaluation.comment ?? '');
      setIsEditingScore(false);
      setIsEditingComment(false);
      setIsSavingScore(false);
      setIsSavingComment(false);
    }
  }, [evaluation]);

  if (!isOpen || !evaluation) return null;

  const handleScoreBlur = async () => {
    if (String(editedScore) === String(evaluation.score ?? '')) {
      setIsEditingScore(false);
      return;
    }
    
    setIsSavingScore(true);
    try {
      await onSave({ ...evaluation, score: editedScore === '' ? null : Number(editedScore) });
    } finally {
      setIsSavingScore(false);
      setIsEditingScore(false);
    }
  };

  const handleCommentBlur = async () => {
    if (editedComment === (evaluation.comment ?? '')) {
      setIsEditingComment(false);
      return;
    }

    setIsSavingComment(true);
    try {
      await onSave({ ...evaluation, comment: editedComment });
    } finally {
      setIsSavingComment(false);
      setIsEditingComment(false);
    }
  };

  const handleCancelScore = () => {
    setEditedScore(evaluation.score ?? '');
    setIsEditingScore(false);
  };

  const handleCancelComment = () => {
    setEditedComment(evaluation.comment ?? '');
    setIsEditingComment(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-[#252525] border-[#3C4144] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-domine text-white flex justify-between items-center">
            <span>Detalhes da Avaliação</span>
            <span className="text-sm font-manrope font-normal text-gray-400">
              {currentIndex + 1} de {totalCount}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-3 gap-4">
             <div>
               <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Pilar</div>
               <div className="text-sm font-semibold text-white">{evaluation.pillar || '-'}</div>
             </div>
             
             <div>
               <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Nota</div>
               <div 
                 className={cn(
                   "relative rounded border border-transparent transition-all duration-200 min-h-[30px] flex items-center",
                   !isEditingScore && !isSavingScore && "hover:border-[#E8B930] hover:bg-[#3C4144] cursor-pointer"
                 )}
                 onClick={() => !isEditingScore && !isSavingScore && setIsEditingScore(true)}
               >
                 {isSavingScore ? (
                   <div className="flex items-center gap-2">
                     <Loader2 className="h-4 w-4 animate-spin text-[#E8B930]" />
                     <span className="text-xs text-gray-400">Salvando...</span>
                   </div>
                 ) : isEditingScore ? (
                   <div className="flex items-center gap-1 w-full">
                     <Input 
                       type="number"
                       value={editedScore}
                       onChange={(e) => setEditedScore(e.target.value)}
                       onBlur={handleScoreBlur}
                       autoFocus
                       className="h-8 bg-[#333] border-[#E8B930] focus-visible:ring-0 text-white w-20"
                     />
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={handleCancelScore}
                        title="Cancelar"
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   </div>
                 ) : (
                   <span className={cn("text-sm font-semibold", !evaluation.score && evaluation.score !== 0 && "text-gray-500 italic")}>
                     {evaluation.score !== null && evaluation.score !== undefined ? evaluation.score : 'Definir'}
                   </span>
                 )}
               </div>
             </div>

             <div>
               <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Nota IA</div>
               <Badge className={cn("font-mono", 
                 evaluation.scoreAI >= 8 ? "bg-green-900/40 text-green-400 border-green-900" :
                 evaluation.scoreAI >= 5 ? "bg-yellow-900/40 text-yellow-400 border-yellow-900" :
                 "bg-red-900/40 text-red-400 border-red-900"
               )}>
                 {evaluation.scoreAI != null ? evaluation.scoreAI : '-'}
               </Badge>
             </div>
          </div>

          <div>
             <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Item Avaliado</div>
             <div className="text-base text-gray-200">{evaluation.item || '-'}</div>
          </div>

          <div className="space-y-4 border-t border-[#3C4144] pt-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider text-[#E8B930] font-manrope">Comentário Original</div>
                {isEditingComment && !isSavingComment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleCancelComment}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Cancelar
                  </Button>
                )}
              </div>
              <div 
                className={cn(
                  "bg-[#33393D] rounded-lg p-3 border border-transparent transition-all duration-200 min-h-[80px]",
                   !isEditingComment && !isSavingComment && "hover:border-[#E8B930] hover:bg-[#3C4144] cursor-pointer"
                )}
                onClick={() => !isEditingComment && !isSavingComment && setIsEditingComment(true)}
              >
                {isSavingComment ? (
                   <div className="flex items-center gap-2 text-gray-400 h-full justify-center min-h-[60px]">
                     <Loader2 className="w-4 h-4 animate-spin text-[#E8B930]" />
                     <span className="text-sm">Salvando...</span>
                   </div>
                ) : isEditingComment ? (
                  <Textarea
                    value={editedComment}
                    onChange={(e) => setEditedComment(e.target.value)}
                    onBlur={handleCommentBlur}
                    autoFocus
                    className="min-h-[80px] bg-[#252525] border-[#E8B930] text-white focus-visible:ring-0 resize-none"
                  />
                ) : (
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">
                    {evaluation.comment || <span className="text-gray-500 italic">Clique para adicionar um comentário...</span>}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-blue-400 font-manrope mb-2">Análise da IA</div>
              <div className="bg-[#33393D] p-3 rounded-lg text-sm text-gray-300 min-h-[60px]">
                {evaluation.commentAI || 'Sem análise.'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center w-full border-t border-[#3C4144] pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onPrev}
              disabled={currentIndex === 0 || isSavingScore || isSavingComment}
              className="border-[#4C4E50] text-gray-300 hover:bg-[#33393D] hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onNext}
              disabled={currentIndex === totalCount - 1 || isSavingScore || isSavingComment}
              className="border-[#4C4E50] text-gray-300 hover:bg-[#33393D] hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BulkEditEvaluationsModal = ({ isOpen, onClose, evaluations, onSaveAll, isSaving }) => {
  const [editedEvaluations, setEditedEvaluations] = useState(evaluations);

  useEffect(() => {
    setEditedEvaluations(evaluations);
  }, [evaluations, isOpen]);

  const handleCommentChange = (index, value) => {
    const newEvals = [...editedEvaluations];
    newEvals[index] = { ...newEvals[index], comment: value };
    setEditedEvaluations(newEvals);
  };

  const handleScoreChange = (index, value) => {
    const newEvals = [...editedEvaluations];
    newEvals[index] = { ...newEvals[index], score: value === '' ? null : Number(value) };
    setEditedEvaluations(newEvals);
  };

  const handleSave = () => {
    onSaveAll(editedEvaluations);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
       <DialogContent className="max-w-4xl bg-[#1B1B1B] border-[#3C4144] text-white h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b border-[#3C4144]">
             <DialogTitle className="text-2xl font-domine text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#E8B930]" />
                Editar Notas e Comentários
             </DialogTitle>
             <DialogDescription className="text-gray-400">
                Edição em massa das avaliações desta reunião.
             </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
             <div className="space-y-6">
                {editedEvaluations.map((ev, idx) => (
                   <div key={idx} className="bg-[#252525] border border-[#3C4144] rounded-lg p-4 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                         <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                               <Badge variant="outline" className="bg-[#33393D] border-[#4C4E50] text-gray-300 text-xs font-normal">
                                  {ev.pillar}
                               </Badge>
                               <span className="text-[#E8B930] text-xs font-bold">Item {idx + 1}</span>
                            </div>
                            <h4 className="text-white font-medium">{ev.item}</h4>
                         </div>
                         
                         <div className="w-full md:w-32">
                            <Label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Nota</Label>
                            <Input 
                               type="number" 
                               value={ev.score ?? ''} 
                               onChange={(e) => handleScoreChange(idx, e.target.value)}
                               className="bg-[#33393D] border-[#4C4E50] text-white focus:border-[#E8B930]"
                            />
                         </div>
                      </div>

                      <div>
                         <Label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Comentário</Label>
                         <Textarea 
                            value={ev.comment || ''}
                            onChange={(e) => handleCommentChange(idx, e.target.value)}
                            className="bg-[#33393D] border-[#4C4E50] text-white focus:border-[#E8B930] min-h-[80px]"
                            placeholder="Adicione um comentário..."
                         />
                      </div>
                   </div>
                ))}
             </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t border-[#3C4144] bg-[#252525]">
             <Button variant="ghost" onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-white mr-2">
                Cancelar
             </Button>
             <Button onClick={handleSave} disabled={isSaving} className="bg-[#E8B930] text-black hover:bg-[#d1a525] font-bold min-w-[120px]">
                {isSaving ? (
                   <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                   </>
                ) : (
                   <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Tudo
                   </>
                )}
             </Button>
          </DialogFooter>
       </DialogContent>
    </Dialog>
  );
};

const MeetingDrawer = ({ meeting, open, onOpenChange, tenantId, onRefresh }) => {
  const { toast } = useToast();
  
  // Local state to hold meeting data for immediate UI updates
  const [localMeeting, setLocalMeeting] = useState(meeting);

  // States for Deletion
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // States for Editing Summary
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);

  // States for Editing Participants
  const [isEditingParticipants, setIsEditingParticipants] = useState(false);
  const [editedParticipants, setEditedParticipants] = useState('');
  const [isSavingParticipants, setIsSavingParticipants] = useState(false);

  // States for Evaluation Details
  const [selectedEvaluationIndex, setSelectedEvaluationIndex] = useState(null);

  // States for Bulk Edit
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  
  // Evaluations Pagination
  const [evaluationsPage, setEvaluationsPage] = useState(1);
  const EVALUATIONS_PER_PAGE = 5;

  // Evaluations Processing - MOVED HERE (Before early return)
  const evaluations = useMemo(() => {
      const evs = localMeeting?.review?.evaluations || [];
      // Sort by score descending
      return [...evs].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [localMeeting]);

  // Sync local state with prop when meeting changes or drawer opens
  useEffect(() => {
    if (open && meeting) {
      setLocalMeeting(meeting); 
      setDeleteInput('');
      setDeleteConfirmationOpen(false);
      setIsEditingSummary(false);
      setEditedSummary(meeting.review?.summary || '');
      setIsSavingSummary(false);
      setIsEditingParticipants(false);
      const participantsValue = Array.isArray(meeting.participants) 
        ? meeting.participants.map(p => p.name || p.email).join(', ') 
        : (meeting.participants || '');
      setEditedParticipants(participantsValue);
      setIsSavingParticipants(false);
      setIsDeleting(false);
      setSelectedEvaluationIndex(null);
      setIsBulkEditing(false);
      setIsSavingBulk(false);
      setEvaluationsPage(1);
    }
  }, [open, meeting]);

  if (!localMeeting) return null;

  const meetingDate = localMeeting.startMoment ? new Date(localMeeting.startMoment) : (localMeeting.date ? new Date(localMeeting.date) : null);
  const formattedDate = meetingDate ? meetingDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
  const formattedTime = meetingDate ? meetingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const durationMinutes = localMeeting.durationMinutes ? localMeeting.durationMinutes : (localMeeting.duration ? Math.floor(localMeeting.duration / 60) : 0);
  const transcriptionLink = localMeeting.review?.filePath;
  const summaryDisplay = isEditingSummary ? editedSummary : (editedSummary || localMeeting.review?.summary); 
  const transcricaoText = localMeeting.transcription || localMeeting.transcricao;

  const totalEvaluationPages = Math.ceil(evaluations.length / EVALUATIONS_PER_PAGE);
  const paginatedEvaluations = evaluations.slice(
      (evaluationsPage - 1) * EVALUATIONS_PER_PAGE,
      evaluationsPage * EVALUATIONS_PER_PAGE
  );

  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={`${lineIndex}-${index}`} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      return (
        <React.Fragment key={lineIndex}>
          {formattedLine}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const handleDownloadTranscription = () => {
    if (!transcricaoText) {
      toast({ variant: "destructive", title: "Erro", description: "Texto da transcrição não disponível." });
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([transcricaoText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    const safeStoreName = (localMeeting.storeName || 'Loja').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeDate = (formattedDate || new Date().toISOString()).replace(/[^a-z0-9]/gi, '_');
    element.download = `transcricao_${safeStoreName}_${safeDate}.txt`;
    document.body.appendChild(element); 
    element.click();
    document.body.removeChild(element);
    toast({ title: "Sucesso", description: "Download da transcrição iniciado." });
  };

  const handleDelete = async () => {
    if (deleteInput !== "DELETAR") return; 
    setIsDeleting(true);
    try {
      const idToSend = localMeeting.meetingId || localMeeting.id || localMeeting._id;
      const response = await fetch('https://n8n.beemotik.com/webhook/reunioesdatameet-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantId, meetingId: idToSend }),
      });
      if (!response.ok) throw new Error('Falha ao deletar reunião');
      toast({ title: "Sucesso", description: "Reunião deletada com sucesso." });
      setDeleteConfirmationOpen(false);
      onOpenChange(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível deletar a reunião." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveSummary = async () => {
    if (editedSummary === (localMeeting.review?.summary || '')) {
      setIsEditingSummary(false);
      return;
    }
    setIsSavingSummary(true);
    try {
      const idToSend = localMeeting.meetingId || localMeeting.id || localMeeting._id;
      const payload = {
        ...localMeeting,
        tenantId: tenantId,
        meetingId: idToSend,
        review: { ...(localMeeting.review || {}), summary: editedSummary }
      };
      const response = await fetch('https://n8n.beemotik.com/webhook/reunioesdatameet-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Falha ao atualizar resumo');
      const updatedData = await response.json();
      if (updatedData && (updatedData.meetingId || updatedData.id)) setLocalMeeting(updatedData);
      else setLocalMeeting(payload);
      toast({ title: "Sucesso", description: "Resumo atualizado com sucesso." });
      setIsEditingSummary(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar o resumo." });
    } finally {
      setIsSavingSummary(false);
    }
  };

  const handleSaveParticipants = async () => {
    const currentParticipants = Array.isArray(localMeeting.participants) ? localMeeting.participants.map(p => p.name || p.email).join(', ') : (localMeeting.participants || '');
    if (editedParticipants === currentParticipants) { setIsEditingParticipants(false); return; }
    setIsSavingParticipants(true);
    try {
      const idToSend = localMeeting.meetingId || localMeeting.id || localMeeting._id;
      const payload = {
        ...localMeeting,
        tenantId: tenantId,
        meetingId: idToSend,
        participants: editedParticipants
      };
      const response = await fetch('https://n8n.beemotik.com/webhook/reunioesdatameet-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Falha ao atualizar participantes');
      const updatedData = await response.json();
      if (updatedData && (updatedData.meetingId || updatedData.id)) setLocalMeeting(updatedData);
      else setLocalMeeting(payload);
      toast({ title: "Sucesso", description: "Participantes atualizados com sucesso." });
      setIsEditingParticipants(false);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar os participantes." });
    } finally {
      setIsSavingParticipants(false);
    }
  };

  const handleSaveEvaluation = async (updatedEvaluation) => {
    try {
       const idToSend = localMeeting.meetingId || localMeeting.id || localMeeting._id;
       const evaluations = [...(localMeeting.review?.evaluations || [])];
       
       const originalIndex = evaluations.findIndex(e => e.item === updatedEvaluation.item && e.pillar === updatedEvaluation.pillar);
       
       if (originalIndex !== -1) {
          evaluations[originalIndex] = updatedEvaluation;
       }

       const payload = {
          ...localMeeting,
          tenantId: tenantId,
          meetingId: idToSend,
          review: { ...(localMeeting.review || {}), evaluations: evaluations }
       };
       const response = await fetch('https://n8n.beemotik.com/webhook/reunioesdatameet-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
       });
       if (!response.ok) throw new Error('Falha ao atualizar avaliação');
       const updatedData = await response.json();
       if (updatedData && (updatedData.meetingId || updatedData.id)) setLocalMeeting(updatedData);
       else setLocalMeeting(payload);
       toast({ title: "Sucesso", description: "Avaliação atualizada com sucesso." });
       if (onRefresh) onRefresh();
    } catch (error) {
       toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a avaliação." });
       throw error;
    }
  };

  const handleSaveBulkEvaluations = async (updatedEvaluations) => {
     setIsSavingBulk(true);
     try {
        const idToSend = localMeeting.meetingId || localMeeting.id || localMeeting._id;
        const payload = {
           ...localMeeting,
           tenantId: tenantId,
           meetingId: idToSend,
           review: { ...(localMeeting.review || {}), evaluations: updatedEvaluations }
        };
        const response = await fetch('https://n8n.beemotik.com/webhook/reunioesdatameet-update', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Falha ao salvar avaliações em massa');
        const updatedData = await response.json();
        if (updatedData && (updatedData.meetingId || updatedData.id)) setLocalMeeting(updatedData);
        else setLocalMeeting(payload);
        toast({ title: "Sucesso", description: "Avaliações atualizadas com sucesso." });
        setIsBulkEditing(false);
        if (onRefresh) onRefresh();
     } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Erro", description: "Falha ao salvar alterações." });
     } finally {
        setIsSavingBulk(false);
     }
  };

  const handleBlurSummary = (e) => { if (e.relatedTarget?.getAttribute('data-action') === 'cancel') return; handleSaveSummary(); };
  const handleBlurParticipants = (e) => { if (e.relatedTarget?.getAttribute('data-action') === 'cancel') return; handleSaveParticipants(); };

  const handlePrevEval = () => setSelectedEvaluationIndex(prev => (prev > 0 ? prev - 1 : prev));
  const handleNextEval = () => setSelectedEvaluationIndex(prev => (prev < evaluations.length - 1 ? prev + 1 : prev));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl bg-[#2F2F2F] border-[#3C4144] text-white max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="text-2xl font-domine text-white">
              Detalhes da Reunião
            </DialogTitle>
             
            {transcricaoText && (
               <Button 
                 onClick={handleDownloadTranscription}
                 variant="outline" 
                 size="sm"
                 className="mr-8 border-[#E8B930] text-[#E8B930] hover:bg-[#E8B930] hover:text-black gap-2"
               >
                 <Download className="w-4 h-4" />
                 Baixar Transcrição
               </Button>
            )}
          </DialogHeader>

          <div className="space-y-6 mt-4 flex-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Loja</div>
                <div className="text-lg font-manrope font-semibold text-white">{localMeeting.storeName}</div>
              </div>
              
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Auditor</div>
                <div className="text-lg font-manrope font-semibold text-white">{localMeeting.auditor?.name || 'N/A'}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Data e Hora</div>
                <div className="text-lg font-manrope font-semibold text-white">{formattedDate} às {formattedTime}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Tempo de Reunião</div>
                <div className="text-lg font-manrope font-semibold text-white">{durationMinutes} minutos</div>
              </div>

              <div className="col-span-2">
                 <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Participantes</div>
                 <div 
                   className={cn(
                     "rounded p-2 border border-transparent transition-all duration-200 -ml-2",
                     !isEditingParticipants && !isSavingParticipants && "hover:border-[#E8B930] hover:bg-[#3C4144] cursor-pointer"
                   )}
                   onClick={() => !isEditingParticipants && !isSavingParticipants && setIsEditingParticipants(true)}
                 >
                    {isSavingParticipants ? (
                       <div className="flex items-center gap-2 text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin text-[#E8B930]" />
                          <span>Salvando...</span>
                       </div>
                    ) : isEditingParticipants ? (
                       <Input
                          value={editedParticipants}
                          onChange={(e) => setEditedParticipants(e.target.value)}
                          onBlur={handleBlurParticipants}
                          autoFocus
                          className="bg-[#252525] border-[#4C4E50] text-white focus-visible:ring-[#E8B930]"
                       />
                    ) : (
                       <div className="text-lg font-manrope font-semibold text-white break-words">
                          {editedParticipants || 'N/A'}
                       </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="border-t border-[#4C4E50] pt-6">
               <div className="flex items-center justify-between mb-3">
                 <div className="text-sm uppercase tracking-wider text-[#E8B930] font-manrope font-bold">Resumo da Reunião</div>
                 {isEditingSummary && !isSavingSummary && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingSummary(false)} data-action="cancel" className="h-8 text-gray-400 hover:text-white hover:bg-[#3C4144]">
                      <XCircle className="w-4 h-4 mr-1.5" /> Cancelar
                    </Button>
                 )}
               </div>
               
               <div 
                 className={cn(
                   "bg-[#33393D] rounded-lg p-4 border border-[#4C4E50] min-h-[120px] relative transition-all duration-200",
                   !isEditingSummary && !isSavingSummary && "cursor-pointer hover:border-[#E8B930] hover:bg-[#3C4144]"
                 )}
                 onClick={() => !isEditingSummary && !isSavingSummary && setIsEditingSummary(true)}
                 title={!isEditingSummary ? "Clique para editar" : ""}
               >
                 {isSavingSummary ? (
                   <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-gray-400 animate-in fade-in">
                      <Loader2 className="w-6 h-6 animate-spin text-[#E8B930] mb-2" />
                      <span className="text-sm">Salvando alterações...</span>
                   </div>
                 ) : isEditingSummary ? (
                   <Textarea 
                      value={editedSummary}
                      onChange={(e) => setEditedSummary(e.target.value)}
                      onBlur={handleBlurSummary}
                      autoFocus
                      className="min-h-[200px] bg-[#252525] border-[#4C4E50] text-white focus-visible:ring-[#E8B930] resize-y"
                   />
                 ) : (
                   <div className="relative group">
                      <p className="text-sm font-manrope text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {summaryDisplay ? renderFormattedText(summaryDisplay) : <span className="italic text-gray-500">Clique para adicionar um resumo...</span>}
                      </p>
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-xs text-[#E8B930] bg-[#252525] px-2 py-1 rounded border border-[#E8B930]/30">Editar</span>
                      </div>
                   </div>
                 )}
               </div>
            </div>

            {/* Evaluations Section with Table */}
            {evaluations.length > 0 && (
              <div className="border-t border-[#4C4E50] pt-6">
                <div className="flex items-center justify-between mb-3">
                   <div className="text-sm uppercase tracking-wider text-[#E8B930] font-manrope font-bold">
                      Notas e Comentários ({evaluations.length})
                   </div>
                   <Button 
                      size="sm" 
                      onClick={() => setIsBulkEditing(true)}
                      className="bg-[#33393D] hover:bg-[#4C4E50] text-white border border-[#4C4E50] h-8"
                   >
                      <Edit2 className="w-3 h-3 mr-2 text-[#E8B930]" />
                      Editar em Massa
                   </Button>
                </div>
                
                <div className="rounded-md border border-[#4C4E50] overflow-hidden">
                  <Table>
                     <TableHeader className="bg-[#33393D]">
                        <TableRow className="border-b-[#4C4E50] hover:bg-[#33393D]">
                           <TableHead className="text-gray-300 font-bold w-[30%]">Avaliação</TableHead>
                           <TableHead className="text-gray-300 font-bold w-[15%]">Nota</TableHead>
                           <TableHead className="text-gray-300 font-bold w-[40%]">Comentário</TableHead>
                           <TableHead className="text-gray-300 font-bold w-[15%]">Data</TableHead>
                           <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {paginatedEvaluations.map((ev, idx) => {
                           // Calculate real index for callbacks
                           const realIndex = (evaluationsPage - 1) * EVALUATIONS_PER_PAGE + idx;
                           return (
                              <TableRow 
                                 key={idx} 
                                 className="border-b-[#4C4E50] hover:bg-[#33393D] transition-colors"
                              >
                                 <TableCell className="font-medium text-white align-top">
                                    {ev.item || 'Item sem nome'}
                                    <div className="text-xs text-gray-500 mt-1">{ev.pillar}</div>
                                 </TableCell>
                                 <TableCell className="align-top">
                                    <div className="flex flex-col gap-1">
                                       {ev.score !== undefined && ev.score !== null ? (
                                          <Badge className="w-fit font-mono bg-blue-900/40 text-blue-400 border-blue-900">
                                            {ev.score}
                                          </Badge>
                                       ) : <span className="text-gray-600 text-xs italic">N/A</span>}
                                       <span className="text-[10px] text-gray-500">IA: {ev.scoreAI != null ? ev.scoreAI : '-'}</span>
                                    </div>
                                 </TableCell>
                                 <TableCell className="text-gray-300 text-sm align-top">
                                    <div className="line-clamp-2" title={ev.comment}>
                                       {ev.comment || <span className="text-gray-600 italic">Sem comentário</span>}
                                    </div>
                                 </TableCell>
                                 <TableCell className="text-gray-400 text-xs align-top">
                                    {formattedDate}
                                 </TableCell>
                                 <TableCell className="text-right align-top">
                                    <Button 
                                       variant="ghost" 
                                       size="icon" 
                                       onClick={() => setSelectedEvaluationIndex(realIndex)}
                                       className="h-8 w-8 text-[#E8B930] hover:text-[#E8B930] hover:bg-[#E8B930]/10"
                                       title="Editar"
                                    >
                                       <Edit2 className="w-4 h-4" />
                                    </Button>
                                 </TableCell>
                              </TableRow>
                           );
                        })}
                     </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalEvaluationPages > 1 && (
                   <div className="flex items-center justify-between mt-4">
                      <Button
                         variant="outline"
                         size="sm"
                         onClick={() => setEvaluationsPage(prev => Math.max(prev - 1, 1))}
                         disabled={evaluationsPage === 1}
                         className="border-[#4C4E50] text-gray-300 hover:bg-[#3C4144] hover:text-white"
                      >
                         <ChevronLeft className="w-4 h-4 mr-1"/> Anterior
                      </Button>
                      <span className="text-xs text-gray-400">
                         Página {evaluationsPage} de {totalEvaluationPages}
                      </span>
                      <Button
                         variant="outline"
                         size="sm"
                         onClick={() => setEvaluationsPage(prev => Math.min(prev + 1, totalEvaluationPages))}
                         disabled={evaluationsPage === totalEvaluationPages}
                         className="border-[#4C4E50] text-gray-300 hover:bg-[#3C4144] hover:text-white"
                      >
                         Próximo <ChevronRight className="w-4 h-4 ml-1"/>
                      </Button>
                   </div>
                )}
              </div>
            )}

            {transcriptionLink && (
              <div className="pt-2">
                 <Button asChild className="w-full bg-[#3C4144] hover:bg-[#4C4E50] text-white font-manrope font-semibold border border-[#4C4E50]">
                  <a href={transcriptionLink} target="_blank" rel="noopener noreferrer">
                    <FileText className="mr-2 h-4 w-4" /> Ver Arquivo Original
                  </a>
                </Button>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-8 border-t border-[#4C4E50] pt-4 sm:justify-between">
             <Button variant="destructive" onClick={() => setDeleteConfirmationOpen(true)} className="bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50">
               <Trash2 className="w-4 h-4 mr-2" /> Deletar Reunião
             </Button>
             <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#4C4E50] text-gray-300 hover:bg-[#3C4144] hover:text-white">
               Fechar
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <DialogContent className="max-w-md bg-[#1B1B1B] border-[#3C4144] text-white">
           <DialogHeader>
             <DialogTitle className="text-xl font-bold text-red-500 flex items-center gap-2">
               <AlertTriangle className="w-6 h-6" /> Deletar Reunião
             </DialogTitle>
             <DialogDescription className="text-gray-400 pt-2">
               Tem certeza que deseja deletar esta reunião? Esta ação não pode ser desfeita.
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-sm text-red-200">
                Para confirmar, digite <strong>DELETAR</strong> no campo abaixo:
              </div>
              <Label htmlFor="confirm-delete" className="sr-only">Confirmação</Label>
              <Input 
                 id="confirm-delete"
                 value={deleteInput}
                 onChange={(e) => setDeleteInput(e.target.value)}
                 placeholder="Digite DELETAR"
                 className="bg-[#252525] border-[#4C4E50] text-white placeholder:text-gray-600 focus-visible:ring-red-500"
              />
           </div>
           <DialogFooter>
             <Button variant="ghost" onClick={() => setDeleteConfirmationOpen(false)} disabled={isDeleting} className="hover:bg-[#333] text-gray-300">Cancelar</Button>
             <Button variant="destructive" onClick={handleDelete} disabled={deleteInput !== 'DELETAR' || isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
               {isDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deletando...</>) : 'Confirmar Exclusão'}
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedEvaluationIndex !== null && evaluations[selectedEvaluationIndex] && (
        <EvaluationDetailModal 
           isOpen={selectedEvaluationIndex !== null}
           onClose={() => setSelectedEvaluationIndex(null)}
           evaluation={evaluations[selectedEvaluationIndex]}
           currentIndex={selectedEvaluationIndex}
           totalCount={evaluations.length}
           onPrev={handlePrevEval}
           onNext={handleNextEval}
           onSave={handleSaveEvaluation}
        />
      )}

      {/* Bulk Edit Modal */}
      <BulkEditEvaluationsModal 
         isOpen={isBulkEditing}
         onClose={() => setIsBulkEditing(false)}
         evaluations={evaluations}
         onSaveAll={handleSaveBulkEvaluations}
         isSaving={isSavingBulk}
      />
    </>
  );
};

export default MeetingDrawer;
