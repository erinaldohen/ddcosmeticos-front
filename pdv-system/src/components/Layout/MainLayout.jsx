import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, DollarSign, Package,
  FileText, ShieldCheck, LogOut, Menu
} from 'lucide-react';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // --- FUNÇÃO DE LOGOUT ROBUSTA ---
  const handleLogout = () => {
    // 1. Limpa o armazenamento
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.clear();

    // 2. Força o recarregamento da página indo para o login
    // Usar window.location.href é mais seguro que navigate() para logout
    // pois limpa todos os estados de memória do React.
    window.location.href = '/login';
  };

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'PDV', path: '/pdv', icon: <ShoppingCart size={20} /> },
    { label: 'Caixa', path: '/caixa', icon: <DollarSign size={20} /> },
    { label: 'Produtos', path: '/produtos', icon: <Package size={20} /> },
    { label: 'Fiscal', path: '/fiscal', icon: <FileText size={20} /> },
    { label: 'Auditoria', path: '/auditoria', icon: <ShieldCheck size={20} /> },
  ];

  return (
    <div className="layout-container">
      {/* MENU LATERAL */}
      <aside className="layout-sidebar">
        <div className="sidebar-logo">
          <h3>DD Cosméticos</h3>
        </div>

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`menu-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
            >
              {item.icon}
              <span className="menu-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO */}
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;