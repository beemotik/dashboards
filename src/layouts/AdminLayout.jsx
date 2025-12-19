
import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  BarChart2, 
  Users, 
  MessageCircle, 
  MessageSquare,
  LayoutDashboard,
  Settings,
  Bot,
  Webhook,
  ChevronDown,
  ChevronRight,
  Database,
  Briefcase,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppContext';

const SidebarItem = ({ to, icon: Icon, label, onClick, end }) => {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const toWithParams = queryString ? `${to}?${queryString}` : to;

  return (
    <NavLink
      to={toWithParams}
      onClick={onClick}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 text-sm font-manrope font-medium transition-all duration-200 border-r-2 ${
          isActive
            ? 'bg-[#3C4144]/50 text-[#E8B930] border-[#E8B930]'
            : 'text-gray-400 hover:text-white hover:bg-[#3C4144]/30 border-transparent'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </NavLink>
  );
};

const AdminLayout = () => {
  const { isAdmin, username, companyName } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile state
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Desktop toggle state
  const [configOpen, setConfigOpen] = useState(true);
  
  const showSidebar = isAdmin;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebarVisibility = () => setIsSidebarVisible(!isSidebarVisible);

  return (
    <div className="min-h-screen bg-[#1B1B1B] flex flex-col md:flex-row">
      {/* Mobile Header */}
      {showSidebar && (
        <div className="md:hidden bg-[#2F2F2F] border-b border-[#3C4144] p-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-white">
              <Menu className="w-6 h-6" />
            </Button>
            <span className="font-domine font-bold text-white text-lg lowercase">dashboards beemotik</span>
          </div>
        </div>
      )}

      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && showSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop & Mobile) */}
      {showSidebar && isSidebarVisible && (
        <aside
          className={`
            fixed md:sticky top-0 left-0 h-full w-64 bg-[#2F2F2F] border-r border-[#3C4144] z-50 transform transition-transform duration-300 ease-in-out flex flex-col
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 md:h-screen
          `}
        >
          <div className="p-6 border-b border-[#3C4144] flex items-center justify-between">
            <h1 className="text-xl font-domine font-bold text-white lowercase">
              <span className="text-[#E8B930]">bee</span>motik
            </h1>
            <Button variant="ghost" size="icon" onClick={closeSidebar} className="md:hidden text-gray-400">
              <X className="w-5 h-5" />
            </Button>
            {/* Desktop Close Sidebar Button */}
            <Button 
               variant="ghost" 
               size="icon" 
               onClick={toggleSidebarVisibility} 
               className="hidden md:flex text-gray-400 hover:text-white hover:bg-[#3C4144]/30"
               title="Recolher Menu"
            >
               <PanelLeftClose className="w-5 h-5" />
            </Button>
          </div>

          <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
            <div className="px-4 mb-2">
              <p className="text-xs font-manrope font-bold text-gray-500 uppercase tracking-wider">
                Menu Principal
              </p>
            </div>
            
            <SidebarItem 
              to="/dashboards/nps" 
              icon={BarChart2} 
              label="NPS" 
              onClick={closeSidebar}
            />
            <SidebarItem 
              to="/dashboards/reunioes" 
              icon={Users} 
              label="Reuniões" 
              onClick={closeSidebar}
            />
             <SidebarItem 
              to="/dashboards/consultores" 
              icon={Briefcase} 
              label="Consultores" 
              onClick={closeSidebar}
            />
            <SidebarItem 
              to="/dashboards/grupos-whatsapp" 
              icon={MessageCircle} 
              label="Grupos de Whatsapp" 
              onClick={closeSidebar}
            />
             <SidebarItem 
              to="/dashboards/conversas" 
              icon={MessageSquare} 
              label="Conversas" 
              onClick={closeSidebar}
            />
            <SidebarItem 
              to="/dashboards/sac" 
              icon={HelpCircle} 
              label="SAC" 
              onClick={closeSidebar}
            />
            
            <div className="px-4 mt-8 mb-2">
              <p className="text-xs font-manrope font-bold text-gray-500 uppercase tracking-wider">
                Ferramentas
              </p>
            </div>

            <SidebarItem 
              to="/dashboards/analysis" 
              icon={Database} 
              label="Análise de Dados" 
              onClick={closeSidebar}
            />

            <SidebarItem 
              to="/dashboards/etc1" 
              icon={LayoutDashboard} 
              label="Análise Financeira" 
              onClick={closeSidebar}
            />
            
            {/* Configurações Group */}
            <div>
              <button 
                onClick={() => setConfigOpen(!configOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-manrope font-medium text-gray-400 hover:text-white hover:bg-[#3C4144]/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5" />
                  <span>Configurações</span>
                </div>
                {configOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              <AnimatePresence>
                {configOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-[#252525]"
                  >
                    <SidebarItem 
                      to="/dashboards/configuracoes/agente" 
                      icon={Bot} 
                      label="Agente" 
                      onClick={closeSidebar}
                    />
                    <SidebarItem 
                      to="/dashboards/configuracoes/webhook" 
                      icon={Webhook} 
                      label="Webhook" 
                      onClick={closeSidebar}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          <div className="p-4 border-t border-[#3C4144]">
            <div className="bg-[#33393D] rounded-lg p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E8B930] flex items-center justify-center text-[#1B1B1B] font-bold font-manrope">
                {username ? username.substring(0, 2).toUpperCase() : 'BM'}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-manrope font-bold text-white truncate">{username}</span>
                <span className="text-xs font-manrope text-gray-400 truncate">{companyName}</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Expand Button (Visible when sidebar is hidden on Desktop) */}
      {showSidebar && !isSidebarVisible && (
         <div className="hidden md:block fixed top-4 left-4 z-50">
            <Button 
               variant="outline" 
               size="icon" 
               onClick={toggleSidebarVisibility} 
               className="bg-[#2F2F2F] border-[#3C4144] text-white hover:bg-[#3C4144]"
               title="Expandir Menu"
            >
               <PanelLeftOpen className="w-5 h-5" />
            </Button>
         </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden md:h-screen md:overflow-y-auto bg-[#1B1B1B] flex flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
