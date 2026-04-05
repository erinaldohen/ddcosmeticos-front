import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar';
import './MainLayout.css';

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // UX: Fecha o menu mobile automaticamente ao trocar de página
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // UX AVANÇADO: Bloqueia o scroll do fundo da página quando o menu mobile está aberto
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = ''; // String vazia é mais segura que 'unset' cross-browser
    }

    // Limpeza de segurança caso o componente seja desmontado
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // ACESSIBILIDADE: Permite fechar o menu mobile com a tecla ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileOpen]);

  // PERFORMANCE: Memoriza as funções para evitar re-renders desnecessários do componente Sidebar
  const toggleCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen(prev => !prev);
  }, []);

  return (
    <div className="layout-wrapper">
      {/* Overlay para fechar o menu mobile ao clicar fora */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay fade-in"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Controlada */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        toggleCollapse={toggleCollapse}
        toggleMobile={toggleMobile}
      />

      {/* Botão Menu Flutuante (Mobile Only) */}
      {!isMobileOpen && (
        <button
          className="mobile-menu-btn bounce-in"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Abrir Menu"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Área de Conteúdo Principal */}
      <main className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;