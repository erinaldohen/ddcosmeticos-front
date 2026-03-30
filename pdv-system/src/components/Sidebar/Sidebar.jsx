import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  Settings, LogOut, ChevronLeft, X,
  FileText, ShieldCheck, Truck, History, Clock,
  Wallet, TrendingDown, Store, ClipboardList, ShoppingBag,
  BarChart3, HeartHandshake, TrendingUp // <-- ÍCONE ADICIONADO AQUI
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

  // Menu Reestruturado com Foco em Usabilidade e Jornada
  const menuGroups = [
      {
        title: 'Operação da Loja',
        items: [
          { path: '/pdv', icon: <ShoppingCart size={20} />, label: 'PDV (Vender)', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA', 'ROLE_USUARIO'] },
          { path: '/caixa', icon: <Store size={20} />, label: 'Meu Caixa', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA', 'ROLE_USUARIO'] },
          { path: '/vendas/historico', icon: <ShoppingBag size={20} />, label: 'Consultar Vendas', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_CAIXA'] },
          { path: '/historico-caixa', icon: <History size={20} />, label: 'Auditoria de Caixas', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
        ]
      },
      {
        title: 'Compras e Estoque',
        items: [
          { path: '/produtos', icon: <Package size={20} />, label: 'Catálogo de Produtos', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/fornecedores', icon: <Users size={20} />, label: 'Fornecedores', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/estoque/entrada', icon: <Truck size={20} />, label: 'Entrada de Notas', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
          { path: '/inventario', icon: <ClipboardList size={20} />, label: 'Balanço / Inventário', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'] },
        ]
      },
      {
        title: 'Central Financeira',
        items: [
          { path: '/financeiro/contas-receber', icon: <Wallet size={20} />, label: 'A Receber (Crediário)', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_FINANCEIRO'] },
          { path: '/financeiro/contas-pagar', icon: <TrendingDown size={20} />, label: 'A Pagar (Boletos)', roles: ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_FINANCEIRO'] },
        ]
      },
      {
        title: 'Gestão Estratégica',
        items: [
          { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard Principal', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/relatorios', icon: <BarChart3 size={20} />, label: 'Relatórios Avançados', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
          { path: '/relatorios/comissoes', icon: <TrendingUp size={20} />, label: 'Gestão de Comissões', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] }, // <-- NOVO MENU AQUI
          { path: '/crm', icon: <HeartHandshake size={20} />, label: 'CRM & Marketing', roles: ['ROLE_ADMIN', 'ROLE_GERENTE'] },
        ]
      },
      {
        title: 'Configurações',
        items: [
          { path: '/auditoria', icon: <ShieldCheck size={20} />, label: 'Logs de Segurança', roles: ['ROLE_ADMIN'] },
          { path: '/configuracoes', icon: <Settings size={20} />, label: 'Ajustes da Loja', roles: ['ROLE_ADMIN'] },
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