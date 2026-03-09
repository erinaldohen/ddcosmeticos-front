import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight, BrainCircuit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import caixaService from '../../services/caixaService';

const AlertasAuditoria = () => {
    const [alertas, setAlertas] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAlertas = async () => {
            try {
                const data = await caixaService.getAlertas();
                setAlertas(data);
            } catch (error) {
                console.error("Erro ao procurar alertas da IA:", error);
            }
        };
        fetchAlertas();
    }, []);

    // Se não houver alertas, o componente fica invisível (não ocupa espaço)
    if (!alertas || !Array.isArray(alertas) || alertas.length === 0) return null;

    return (
        <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px',
            padding: '20px', marginBottom: '25px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)',
            animation: 'fadeIn 0.5s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                <div style={{ background: '#ef4444', color: 'white', padding: '10px', borderRadius: '50%', display: 'flex' }}>
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h2 style={{ margin: 0, color: '#991b1b', fontSize: '1.3rem', fontWeight: '800' }}>
                        Atenção Necessária
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: '#b91c1c', fontWeight: '600' }}>
                        A Inteligência Artificial detetou {alertas.length} {alertas.length === 1 ? 'fecho' : 'fechos'} de caixa com risco de divergência.
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alertas.map(alerta => {
                    const isAlto = alerta.analiseAuditoriaIa?.includes('ALTO');
                    const quebra = Math.abs(alerta.diferencaCaixa || 0);

                    return (
                        <div key={alerta.id} style={{
                            background: 'white', borderRadius: '8px', padding: '15px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderLeft: `4px solid ${isAlto ? '#ef4444' : '#f59e0b'}`
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                    <strong style={{ color: '#1e293b', fontSize: '1.1rem' }}>PDV #{alerta.id} - {alerta.operadorNome}</strong>
                                    <span style={{
                                        background: isAlto ? '#fee2e2' : '#fef3c7',
                                        color: isAlto ? '#b91c1c' : '#d97706',
                                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    }}>
                                        <BrainCircuit size={12}/> RISCO {isAlto ? 'ALTO' : 'MÉDIO'}
                                    </span>
                                </div>
                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                    Quebra de <b>R$ {quebra.toFixed(2)}</b>. Justificação: <i>"{alerta.justificativaDiferenca}"</i>
                                </span>
                            </div>

                            <button
                                onClick={() => navigate('/historico-caixa')}
                                style={{
                                    background: 'transparent', border: '1px solid #cbd5e1', padding: '8px 16px',
                                    borderRadius: '8px', cursor: 'pointer', fontWeight: '700', color: '#475569',
                                    display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; }}
                            >
                                Analisar <ChevronRight size={16}/>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AlertasAuditoria;