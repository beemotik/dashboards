import React from 'react';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MeetingDrawer = ({ meeting, open, onOpenChange }) => {
  if (!meeting) return null;

  const meetingDate = meeting.startMoment ? new Date(meeting.startMoment) : (meeting.date ? new Date(meeting.date) : null);
  
  const formattedDate = meetingDate 
    ? meetingDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
    : 'N/A';
  
  const formattedTime = meetingDate
    ? meetingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const durationMinutes = meeting.durationMinutes 
    ? meeting.durationMinutes 
    : (meeting.duration ? Math.floor(meeting.duration / 60) : 0);

  const transcriptionLink = meeting.review?.filePath;
  const summary = meeting.review?.summary;

  // Simple Markdown-ish parser for bold text (**text**) and new lines
  const renderFormattedText = (text) => {
    if (!text) return null;
    
    // Split by newlines first
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      // Split each line by double asterisks
      const parts = line.split(/(\*\*.*?\*\*)/g);
      
      const formattedLine = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Remove asterisks and render bold
          return <strong key={`${lineIndex}-${index}`} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      // Add a <br /> for new lines, but not after the last line
      return (
        <React.Fragment key={lineIndex}>
          {formattedLine}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#2F2F2F] border-[#3C4144] text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-domine text-white">
            Detalhes da Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Loja</div>
              <div className="text-lg font-manrope font-semibold text-white">{meeting.storeName}</div>
            </div>
            
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Auditor</div>
              <div className="text-lg font-manrope font-semibold text-white">{meeting.auditor?.name || 'N/A'}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Data e Hora</div>
              <div className="text-lg font-manrope font-semibold text-white">
                {formattedDate} às {formattedTime}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-manrope mb-1">Tempo de Reunião</div>
              <div className="text-lg font-manrope font-semibold text-white">
                {durationMinutes} minutos
              </div>
            </div>
          </div>

          <div className="border-t border-[#4C4E50] pt-6">
             <div className="text-sm uppercase tracking-wider text-[#E8B930] font-manrope font-bold mb-3">
               Resumo da Reunião
             </div>
             <div className="bg-[#33393D] rounded-lg p-4 border border-[#4C4E50]">
               <p className="text-sm font-manrope text-gray-300 leading-relaxed">
                 {summary ? renderFormattedText(summary) : "Nenhum resumo disponível para esta reunião."}
               </p>
             </div>
          </div>

          {transcriptionLink && (
            <div className="pt-2">
               <Button 
                asChild
                className="w-full bg-[#E8B930] hover:bg-[#FFD54F] text-[#1B1B1B] font-manrope font-semibold"
              >
                <a href={transcriptionLink} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Transcrição Completa
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingDrawer;