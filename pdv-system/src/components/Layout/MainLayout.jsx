import React from 'react';
import {
  Activity,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Scale,
  Settings,
  LogOut
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'Auditoria', path: '/auditoria', icon: <Activity size={20} /> },
    { name: 'Visão Geral', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Vendas (PDV)', path: '/pdv', icon: <ShoppingCart size={20} /> },
    { name: 'Produtos', path: '/produtos', icon: <Package size={20} /> },
    { name: 'Clientes', path: '/clientes', icon: <Users size={20} /> },
    // --- NOVO ITEM FISCAL ---
    { name: 'Painel Fiscal', path: '/fiscal/retencao', icon: <Scale size={20} /> },
    // ------------------------
    { name: 'Configurações', path: '/config', icon: <Settings size={20} /> },
  ];

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="brand-area">
          <img src="/logo.png" alt="DD Logo" className="sidebar-logo" />
        </div>

        <nav className="nav-menu" style={{height: '100%'}}>
          {menuItems.map((item) => (
            <div
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </div>
          ))}

          {/* Botão Sair separado */}
          <div className="nav-item logout" onClick={() => navigate('/')}>
             <span className="nav-icon"><LogOut size={20} /></span>
             <span>Sair do Sistema</span>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;