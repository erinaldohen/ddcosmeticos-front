import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, DollarSign, Package,
  FileText, ShieldCheck, LogOut, History, User, Menu, X
} from 'lucide-react';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false); // Estado para Mobile

  // Recupera dados do usuário
  const usuarioJson = localStorage.getItem('usuario');
  const usuario = usuarioJson ? JSON.parse(usuarioJson) : { nome: 'Operador', role: 'Staff' };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const toggleMenu = () => setMenuAberto(!menuAberto);
  const fecharMenu = () => setMenuAberto(false);

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'PDV (Frente)', path: '/pdv', icon: <ShoppingCart size={20} /> },
    { label: 'Gerir Caixa', path: '/caixa', icon: <DollarSign size={20} /> },
    { label: 'Histórico Caixas', path: '/historico-caixa', icon: <History size={20} /> },
    { label: 'Produtos', path: '/produtos', icon: <Package size={20} /> },
    { label: 'Fiscal', path: '/fiscal', icon: <FileText size={20} /> },
    { label: 'Auditoria', path: '/auditoria', icon: <ShieldCheck size={20} /> },
  ];

  return (
    <div className="layout-container">

      {/* 1. OVERLAY (Fundo escuro no mobile quando menu abre) */}
      {menuAberto && (
        <div className="mobile-overlay" onClick={fecharMenu}></div>
      )}

      {/* 2. SIDEBAR (Menu Lateral) */}
      <aside className={`layout-sidebar ${menuAberto ? 'mobile-open' : ''}`}>
        <div className="sidebar-header-mobile">
            {/* Botão X só aparece no mobile */}
            <div className="logo-icon">DD</div>
            <button className="btn-close-menu" onClick={fecharMenu}>
              <X size={24} color="#64748b" />
            </button>
        </div>

        <div className="sidebar-logo desktop-only">
          <div className="logo-icon">DD</div>
          <h3>DD Cosméticos</h3>
        </div>

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={fecharMenu} // Fecha o menu ao clicar no link (UX Mobile)
              className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
              <span className="menu-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info-sidebar">
            <div className="user-avatar">
              <User size={16} />
            </div>
            <div className="user-details">
              {/* Proteção contra nomes nulos */}
              <span className="user-name">{(usuario.nome || 'User').split(' ')[0]}</span>
              <span className="user-role">{usuario.role || usuario.perfil || 'Operador'}</span>
            </div>
          </div>

          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={20} />
            <span className="label-logout">Sair</span>
          </button>
        </div>
      </aside>

      {/* 3. CONTEÚDO PRINCIPAL */}
      <main className="layout-content">

        {/* HEADER MOBILE (Hambúrguer) - Só aparece em telas pequenas */}
        <header className="mobile-top-bar">
          <button onClick={toggleMenu} className="btn-hamburger">
            <Menu size={24} color="#334155" />
          </button>
          <span className="mobile-title">DD Cosméticos</span>
          <div style={{width: 24}}></div> {/* Espaçador para centralizar */}
        </header>

        <div className="content-wrapper">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;