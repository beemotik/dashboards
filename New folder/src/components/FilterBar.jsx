
import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ListFilter } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

const FilterBar = ({ 
  filters, 
  onFilterChange, 
  onApply, 
  meetings, 
  availableCompanies, 
  companiesLoading,
  isDropdownLocked = false // Default to false if not provided
}) => {
  const { isAdmin } = useAppContext();
  const [storeOptions, setStoreOptions] = useState(['ALL']);
  const [auditorOptions, setAuditorOptions] = useState(['ALL']);

  useEffect(() => {
    if (meetings && meetings.length > 0) {
      // Extract unique store names
      const stores = new Set(['ALL']);
      const auditors = new Set(['ALL']);
      
      meetings.forEach(meeting => {
        if (meeting.storeName) stores.add(meeting.storeName);
        if (meeting.auditor?.name) auditors.add(meeting.auditor.name);
      });

      setStoreOptions(Array.from(stores).sort());
      setAuditorOptions(Array.from(auditors).sort());
    } else {
      setStoreOptions(['ALL']);
      setAuditorOptions(['ALL']);
    }
  }, [meetings]);

  const handleSelectChange = (key, value) => {
    onFilterChange({ [key]: value });
  };

  const handleDateChange = (key, value) => {
    onFilterChange({ [key]: value });
  };

  return (
    <div className="sticky top-0 z-30 bg-[#2F2F2F] border-b border-[#3C4144] px-6 py-4 shadow-md">
      <div className="flex flex-col gap-4">
        {/* Main Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          
          {/* Company Filter - Now respects isDropdownLocked */}
          <div className="space-y-2 max-w-full">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Empresa</Label>
            <Select
              value={filters.companyName}
              onValueChange={(val) => handleSelectChange('companyName', val)}
              disabled={companiesLoading || isDropdownLocked || availableCompanies.length === 0}
            >
              <SelectTrigger className="bg-[#33393D] border-[#4C4E50] text-white h-10 w-full opacity-100 disabled:opacity-80 disabled:cursor-not-allowed">
                <SelectValue placeholder={
                  companiesLoading ? "Carregando..." : 
                  availableCompanies.length === 0 ? "Acesso restrito" :
                  "Selecione..."
                } />
              </SelectTrigger>
              <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white max-w-[300px]">
                {availableCompanies.map((company) => (
                  <SelectItem key={company} value={company} className="truncate">
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-gray-300 text-xs uppercase tracking-wider font-bold">Período</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => handleDateChange('from', e.target.value)}
                className="bg-[#33393D] border-[#4C4E50] text-white h-10"
              />
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => handleDateChange('to', e.target.value)}
                className="bg-[#33393D] border-[#4C4E50] text-white h-10"
              />
            </div>
          </div>

          {/* Filter Button */}
          <div className="lg:col-span-2">
             <Button 
                onClick={onApply}
                className="w-full bg-[#E8B930] hover:bg-[#d1a525] text-black font-bold h-10"
              >
                <ListFilter className="w-4 h-4 mr-2" />
                Filtrar Dados
              </Button>
          </div>
        </div>

        {/* Secondary Filters (Client-side) - Only visible if data is loaded */}
        {meetings && meetings.length > 0 && (
          <div className="pt-4 border-t border-[#3C4144] grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
            
            {/* Store Filter */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Loja</Label>
              <Select
                value={filters.storeName || 'ALL'}
                onValueChange={(val) => handleSelectChange('storeName', val)}
              >
                <SelectTrigger className="bg-[#252525] border-[#3C4144] text-gray-300 h-9 text-sm">
                  <SelectValue placeholder="Todas as Lojas" />
                </SelectTrigger>
                <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                  {storeOptions.map(option => (
                    <SelectItem key={option} value={option}>{option === 'ALL' ? 'Todas as Lojas' : option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auditor Filter */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Auditor</Label>
               <Select
                value={filters.auditor || 'ALL'}
                onValueChange={(val) => handleSelectChange('auditor', val)}
              >
                <SelectTrigger className="bg-[#252525] border-[#3C4144] text-gray-300 h-9 text-sm">
                  <SelectValue placeholder="Todos Auditores" />
                </SelectTrigger>
                <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                  {auditorOptions.map(option => (
                    <SelectItem key={option} value={option}>{option === 'ALL' ? 'Todos Auditores' : option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             {/* Status Filter */}
             <div className="space-y-2">
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Status</Label>
               <Select
                value={filters.status || 'Todas'}
                onValueChange={(val) => handleSelectChange('status', val)}
              >
                <SelectTrigger className="bg-[#252525] border-[#3C4144] text-gray-300 h-9 text-sm">
                  <SelectValue placeholder="Todos Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#2F2F2F] border-[#4C4E50] text-white">
                  <SelectItem value="Todas">Todas</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                  <SelectItem value="Não respondida">Não respondida</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
