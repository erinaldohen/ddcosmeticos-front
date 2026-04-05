import React, { useState, useEffect } from 'react';
import { ShoppingBag, Smartphone } from 'lucide-react';
import './PDV.css';

const CustomerDisplay = () => {
    const [pdvState, setPdvState] = useState({
        carrinho: [], totalPagar: 0, totalPago: 0, troco: 0, cliente: '', metodoAtual: 'PIX', status: 'LIVRE'
    });

    useEffect(() => {
        // Conecta no mesmo "canal de rádio" do PDV principal
        const channel = new BroadcastChannel('pdv_channel');

        channel.onmessage = (event) => {
            if (event.data.type === 'PDV_UPDATE') {
                setPdvState(event.data.payload);
            }
        };

        return () => channel.close();
    }, []);

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    return (
        <div style={{ height: '100vh', display: 'flex', backgroundColor: '#0f172a', color: 'white', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

            {/* LADO ESQUERDO: CUPOM DO CLIENTE */}
            <div style={{ flex: '1', backgroundColor: '#1e293b', padding: '40px', display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ color: '#38bdf8', fontSize: '2.5rem', marginBottom: '10px' }}>DD Cosméticos</h1>
                <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '30px' }}>
                    {pdvState.cliente ? `Cliente: ${pdvState.cliente}` : 'Bem-vindo(a)!'}
                </p>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '20px' }}>
                    {pdvState.carrinho.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569' }}>
                            <ShoppingBag size={80} style={{ marginBottom: '20px', opacity: 0.5 }} />
                            <h2>Caixa Livre</h2>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {pdvState.carrinho.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#334155', padding: '20px', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <span style={{ backgroundColor: '#0f172a', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold' }}>{item.quantidade}x</span>
                                        <span style={{ fontSize: '1.4rem', fontWeight: '600' }}>{item.descricao}</span>
                                    </div>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>
                                        {formatarMoeda(item.precoVenda * item.quantidade)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* LADO DIREITO: TOTAIS E QR CODE PIX */}
            <div style={{ width: '450px', backgroundColor: '#0f172a', padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '2px solid #334155' }}>

                <div>
                    <div style={{ marginBottom: '40px' }}>
                        <p style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>Total a Pagar</p>
                        <h2 style={{ fontSize: '4.5rem', margin: 0, color: '#fff', lineHeight: 1 }}>{formatarMoeda(pdvState.totalPagar)}</h2>
                    </div>

                    <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
                        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '5px' }}>Valor Pago</p>
                        <h3 style={{ fontSize: '2.5rem', margin: 0, color: '#38bdf8' }}>{formatarMoeda(pdvState.totalPago)}</h3>
                    </div>

                    {pdvState.troco > 0 && (
                        <div style={{ backgroundColor: '#064e3b', padding: '24px', borderRadius: '16px' }}>
                            <p style={{ color: '#34d399', fontSize: '1.1rem', marginBottom: '5px' }}>Seu Troco</p>
                            <h3 style={{ fontSize: '3rem', margin: 0, color: '#10b981' }}>{formatarMoeda(pdvState.troco)}</h3>
                        </div>
                    )}
                </div>

                {pdvState.status === 'PAGAMENTO' && pdvState.metodoAtual === 'PIX' && pdvState.totalPagar > pdvState.totalPago && (
                    <div style={{ textAlign: 'center', backgroundColor: '#1e293b', padding: '30px', borderRadius: '24px', animation: 'fadeInUp 0.5s ease' }}>
                        <Smartphone size={40} color="#34d399" style={{ marginBottom: '15px' }}/>
                        <h3 style={{ marginBottom: '20px' }}>Pague com PIX</h3>
                        <div style={{ background: 'white', padding: '20px', borderRadius: '16px', display: 'inline-block' }}>
                            {/* Um gerador de QR Code genérico apenas para demonstração visual ao cliente */}
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=0002012636br.gov.bcb.pix011457648950000144520400005303986540${(pdvState.totalPagar - pdvState.totalPago).toFixed(2).replace('.','')}5802BR5903BRL6009SAO PAULO6207TERRACO6304EB4368040000`} alt="PIX" style={{ width: '100%', height: 'auto', display: 'block' }}/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDisplay;