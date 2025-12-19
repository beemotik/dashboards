
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import AdminLayout from '@/layouts/AdminLayout';
import Dashboard from '@/components/Dashboard';
import WhatsAppGroupsDashboard from '@/components/WhatsAppGroupsDashboard';
import NpsDashboard from '@/components/NpsDashboard';
import ConversasDashboard from '@/components/ConversasDashboard';
import ConsultoresDashboard from '@/components/ConsultoresDashboard';
import DebugAnalysis from '@/components/DebugAnalysis';
import SACTab from '@/components/SACTab';
import Placeholder from '@/pages/Placeholder';
import { Toaster } from '@/components/ui/toaster';
import { AppProvider } from '@/context/AppContext';

function App() {
  return (
    <>
      <Helmet>
        <title>dashboards beemotik</title>
        <meta name="description" content="Painel administrativo de dashboards da Beemotik" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Domine:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>
      
      <AppProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboards/reunioes" replace />} />
          
          <Route path="/dashboards" element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboards/reunioes" replace />} />
            
            <Route path="reunioes" element={<Dashboard />} />
            <Route path="consultores" element={<ConsultoresDashboard />} />
            <Route path="nps" element={<NpsDashboard />} />
            <Route path="grupos-whatsapp" element={<WhatsAppGroupsDashboard />} />
            <Route path="conversas" element={<ConversasDashboard />} />
            <Route path="sac" element={<SACTab />} />
            <Route path="analysis" element={<DebugAnalysis />} />
            
            <Route path="etc1" element={<Placeholder title="Análise Financeira" />} />
            
            {/* Configurações Submenu Routes */}
            <Route path="configuracoes">
              <Route index element={<Navigate to="agente" replace />} />
              <Route path="agente" element={<Placeholder title="Configuração do Agente" />} />
              <Route path="webhook" element={<Placeholder title="Configuração de Webhook" />} />
            </Route>
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboards/reunioes" replace />} />
        </Routes>
      </AppProvider>
      
      <Toaster />
    </>
  );
}

export default App;
