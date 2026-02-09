import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, LogOut, ChevronLeft, X, DollarSign,
  FileText, ShieldCheck, Truck, History, Clock,
  Wallet, TrendingDown, Store // Adicionei Store para Frente de Loja
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isMobileOpen, isCollapsed, toggleMobile, toggleCollapse }) => {
  const location = useLocation();
  const [userRole, setUserRole] = useState('');

  // Relógio
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
        setHora(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recuperar perfil
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user') || localStorage.getItem('usuario');
      if (userStr) {
        const user = JSON.parse(userStr);
        const role = user.perfil || user.perfilDoUsuario || user.role || 'ROLE_USUARIO';
        setUserRole(role);
      }
    } catch (e) {
      console.error("Erro ao ler perfil:", e);
    }
  }, []);

  /* NOVA ESTRUTURA DE MENU:
     1. Visão Geral (Dashboard)
     2. Frente de Loja (Operacional: PDV e Caixa)
     3. Gestão Financeira (Contas e Históricos)
     4. Estoque e Cadastros (Produtos, Fornecedores, NFe)
     5. Fiscal e Sistema (Relatórios, Auditoria, Config)
  */
  const menuGroups = [
      {
        title: 'Visão Geral',
        items: [
          { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
        ]
      },
      {
        title: 'Frente de Loja',
        items: [
          { path: '/pdv', icon: <ShoppingCart size={20} />, label: 'PDV (Vendas)', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA', 'ROLE_USUARIO'] },
          { path: '/caixa', icon: <Store size={20} />, label: 'Controle de Caixa', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA', 'ROLE_USUARIO'] },
        ]
      },
      {
        title: 'Gestão Financeira',
        items: [
          { path: '/financeiro/contas-receber', icon: <Wallet size={20} />, label: 'Contas a Receber', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/financeiro/contas-pagar', icon: <TrendingDown size={20} />, label: 'Contas a Pagar', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/historico-caixa', icon: <History size={20} />, label: 'Histórico de Caixa', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
        ]
      },
      {
        title: 'Estoque e Cadastros',
        items: [
          { path: '/produtos', icon: <Package size={20} />, label: 'Produtos', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/estoque/entrada', icon: <Truck size={20} />, label: 'Entrada de Nota', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/fornecedores', icon: <Users size={20} />, label: 'Fornecedores', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
        ]
      },
      {
        title: 'Fiscal e Sistema',
        items: [
          { path: '/fiscal', icon: <FileText size={20} />, label: 'Relatórios Fiscais', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/auditoria', icon: <ShieldCheck size={20} />, label: 'Auditoria', roles: ['ROLE_ADMIN'] },
          { path: '/configuracoes', icon: <Settings size={20} />, label: 'Configurações', roles: ['ROLE_ADMIN'] },
        ]
      }
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <>
      <div className={`sidebar-overlay ${isMobileOpen ? 'active' : ''}`} onClick={toggleMobile} />

      <aside className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>

        {/* HEADER */}
        <div className="sidebar-header">
          <h1 className="logo-text">
            {!isCollapsed ? <>DD<span>Cosméticos</span></> : <span style={{color:'#2563eb'}}>DD</span>}
          </h1>
          <button className="btn-toggle-sidebar desktop-only" onClick={toggleCollapse}>
            <ChevronLeft size={20} className={isCollapsed ? 'rotate-180' : ''}/>
          </button>
          <button className="btn-toggle-sidebar mobile-only" onClick={toggleMobile}>
            <X size={20}/>
          </button>
        </div>

        {/* RELÓGIO */}
        <div className="sidebar-clock-widget">
             {isCollapsed ? (
                 <div className="clock-collapsed"><Clock size={18} /></div>
             ) : (
                 <>
                    <Clock size={16} className="clock-icon"/>
                    <span className="clock-time">{hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="clock-seconds">{hora.toLocaleTimeString('pt-BR', { second: '2-digit' })}</span>
                 </>
             )}
        </div>

        <nav className="sidebar-nav">
          {menuGroups.map((group, index) => {
            // Filtra itens com base no perfil do usuário
            const visibleItems = group.items.filter(item => item.roles.includes(userRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={index} className="menu-group">
                {!isCollapsed && <h4 className="group-title">{group.title}</h4>}
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => isMobileOpen && toggleMobile()}
                    data-tooltip={isCollapsed ? item.label : null}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {location.pathname === item.path && !isCollapsed && <div className="active-indicator" />}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-item logout"
            onClick={handleLogout}
            data-tooltip={isCollapsed ? "Sair do Sistema" : null}
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