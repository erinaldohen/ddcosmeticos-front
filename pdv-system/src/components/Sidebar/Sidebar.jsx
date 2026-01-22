import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, LogOut, ChevronLeft, X, DollarSign,
  PieChart, FileText, ShieldCheck, Truck, History
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isMobileOpen, isCollapsed, toggleMobile, toggleCollapse }) => {
  const location = useLocation();

  // ESTRUTURA ORGANIZADA POR SESSÕES
  // Removemos o item "Estoque" avulso pois era duplicado de "Produtos"
  const menuGroups = [
    {
      title: 'Principal',
      items: [
        { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { path: '/pdv', icon: <ShoppingCart size={20} />, label: 'PDV (Vendas)' },
      ]
    },
    {
      title: 'Financeiro',
      items: [
        { path: '/caixa', icon: <DollarSign size={20} />, label: 'Gerir Caixa' },
        { path: '/historico-caixa', icon: <History size={20} />, label: 'Histórico' },
      ]
    },
    {
      title: 'Gestão',
      items: [
        { path: '/produtos', icon: <Package size={20} />, label: 'Produtos' }, // Produtos = Estoque
        { path: '/estoque/entrada', icon: <Truck size={20} />, label: 'Entrada NFe' },
        { path: '/fornecedores', icon: <Users size={20} />, label: 'Fornecedores' },
      ]
    },
    {
      title: 'Controle',
      items: [
        { path: '/fiscal', icon: <FileText size={20} />, label: 'Fiscal' },
        { path: '/auditoria', icon: <ShieldCheck size={20} />, label: 'Auditoria' },
        { path: '/configuracoes', icon: <Settings size={20} />, label: 'Configurações' },
      ]
    }
  ];

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={toggleMobile}
      />

      <aside className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>

        <div className="sidebar-header">
          <h1 className="logo-text">
            {!isCollapsed ? <>DD<span>Cosméticos</span></> : <span style={{color:'#2563eb'}}>DD</span>}
          </h1>

          <button
            className="btn-toggle-sidebar desktop-only"
            onClick={toggleCollapse}
            data-tooltip={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            <ChevronLeft size={20} className={isCollapsed ? 'rotate-180' : ''}/>
          </button>

          <button
            className="btn-toggle-sidebar mobile-only"
            onClick={toggleMobile}
          >
            <X size={20}/>
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuGroups.map((group, index) => (
            <div key={index} className="menu-group">
              {/* Título da Sessão (Só aparece se não estiver recolhido) */}
              {!isCollapsed && <h4 className="group-title">{group.title}</h4>}

              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  data-tooltip={isCollapsed ? item.label : ''}
                  onClick={() => isMobileOpen && toggleMobile()}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {location.pathname === item.path && !isCollapsed && <div className="active-indicator" />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-item logout"
            onClick={handleLogout}
            data-tooltip={isCollapsed ? "Sair do Sistema" : ''}
          >
            <span className="nav-icon"><LogOut size={20} /></span>
            <span className="nav-label">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;