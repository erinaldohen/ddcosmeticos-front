import React, { useState } from 'react';
import { Outlet } from 'react-router-dom'; // <--- IMPORTANTE: Substitui o 'children'
import { Menu } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';
import './MainLayout.css';

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="layout-wrapper">
      {/* Sidebar Controlada pelo Layout */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        toggleMobile={() => setIsMobileOpen(!isMobileOpen)}
      />

      {/* Botão Menu Flutuante (Aparece só no Mobile) */}
      <button className="mobile-menu-btn" onClick={() => setIsMobileOpen(true)}>
        <Menu size={24} />
      </button>

      {/* Área de Conteúdo Principal */}
      <div className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        {/* O Outlet renderiza a página atual (Dashboard, PDV, etc) */}
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;