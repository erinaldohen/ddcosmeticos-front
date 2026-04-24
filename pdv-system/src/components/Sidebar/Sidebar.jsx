import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, LogOut, ChevronLeft, X,
  ShieldCheck, Truck, History, Clock,
  Wallet, TrendingDown, Store, ClipboardList, ShoppingBag,
  BarChart3, HeartHandshake, TrendingUp, FileText, Inbox
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isMobileOpen, isCollapsed, toggleMobile, toggleCollapse }) => {
  const location = useLocation();
  const [userRole, setUserRole] = useState('');
  const [hora, setHora] = useState(new Date());

  // Relógio
  useEffect(() => {
    const timer = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Recuperar perfil
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const role = user.perfilDoUsuario || user.perfil || user.role || 'ROLE_USUARIO';
        setUserRole(role);
      }
    } catch (e) {
      console.error("Erro ao ler perfil:", e);
    }
  }, []);

  // =========================================================================
  // MENU REESTRUTURADO
  // =========================================================================
  const menuGroups = [
      {
        title: 'Vendas',
        items: [
          { path: '/pdv', icon: <ShoppingCart size={20} />, label: 'Caixa (PDV)', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA', 'ROLE_USUARIO'] },
          { path: '/caixa', icon: <Store size={20} />, label: 'Abrir / Fechar Caixa', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA', 'ROLE_USUARIO'] },
          { path: '/fiado', icon: <Wallet size={20} />, label: 'Fiado / Crediário', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_FINANCEIRO', 'ROLE_CAIXA'] },
          { path: '/vendas/historico', icon: <ShoppingBag size={20} />, label: 'Histórico de Vendas', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA'] },
        ]
      },
      {
        title: 'Estoque',
        items: [
          { path: '/produtos', icon: <Package size={20} />, label: 'Produtos', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          // 🔥 ADICIONADO: A Nova Caixa de Entrada SEFAZ 🔥
          { path: '/estoque/sefaz', icon: <Inbox size={20} />, label: 'Caixa de Entrada SEFAZ', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/estoque/entrada', icon: <Truck size={20} />, label: 'Importar XML', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/historico-notas', icon: <FileText size={20} />, label: 'Histórico XML', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/inventario', icon: <ClipboardList size={20} />, label: 'Inventário (IA)', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/fornecedores', icon: <Users size={20} />, label: 'Fornecedores', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
        ]
      },
      {
        title: 'Gestão',
        items: [
          { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/relatorios', icon: <BarChart3 size={20} />, label: 'Relatórios', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/financeiro/contas-pagar', icon: <TrendingDown size={20} />, label: 'Contas a Pagar', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_FINANCEIRO'] },
          { path: '/relatorios/comissoes', icon: <TrendingUp size={20} />, label: 'Comissões', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/historico-caixa', icon: <History size={20} />, label: 'Fechos de Caixa', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/crm', icon: <HeartHandshake size={20} />, label: 'CRM / Clientes', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
        ]
      },
      {
        title: 'Sistema',
        items: [
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
            {!isCollapsed ? <>DD<span>Cosméticos</span></> : <span style={{color:'#d11d7e'}}>DD</span>}
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
            const visibleItems = group.items.filter(item => {
              if (!item.roles) return true;
              const userRoleClean = userRole.replace('ROLE_', '');
              return item.roles.some(r => r.includes(userRoleClean));
            });

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
                    title={isCollapsed ? item.label : null}
                  >
                    <span className="nav-icon">
                       {item.icon}
                       {/* Ponto Vermelho de Alerta na SEFAZ */}
                       {item.path === '/estoque/sefaz' && !isCollapsed && (
                           <span style={{ position:'absolute', top:'8px', left:'26px', background:'#ef4444', width:'8px', height:'8px', borderRadius:'50%' }}></span>
                       )}
                    </span>
                    <span className="nav-label">{item.label}</span>
                    {location.pathname === item.path && !isCollapsed && <div className="active-indicator" />}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout" onClick={handleLogout} title={isCollapsed ? "Sair" : null}>
            <span className="nav-icon"><LogOut size={20} /></span>
            <span className="nav-label">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;