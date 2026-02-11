import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar'; // Verifique se o caminho está correto na sua pasta
import './MainLayout.css';

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="layout-wrapper">
      {/* Sidebar Controlada */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        toggleMobile={() => setIsMobileOpen(!isMobileOpen)}
      />

      {/* Botão Menu Flutuante (Mobile Only) */}
      <button className="mobile-menu-btn" onClick={() => setIsMobileOpen(true)} aria-label="Abrir Menu">
        <Menu size={24} />
      </button>

      {/* Área de Conteúdo Principal */}
      <div className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;