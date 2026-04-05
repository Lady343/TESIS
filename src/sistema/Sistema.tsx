import { useState, useEffect } from 'react';
import Sidebar from './layout/Sidebar';
import Overview from './views/Overview';
import Ticket from './views/Ticket';
import Transportista from './views/Transportista';
import Vehiculo from './views/Vehiculo';
import Cliente from './views/Cliente';
import Extra from './views/Extra';
import TrabajoMaquinaria from './views/TrabajoMaquinaria';
import Reportes from './views/Reportes';
import Usuario from './views/Usuario';
import Catalogos from './views/Catalogos';
import Pago from './views/Pago';
import MetricasIA from './views/MetricasIA';
import { useUser } from './UserContext';

import { SystemView } from './types';

interface SistemaProps {
    onLogout: () => void;
    userEmail: string;
}

// Mapa de vistas restringidas por rol mínimo
const RESTRICTED_VIEWS: Partial<Record<SystemView, string[]>> = {
    pago:        ['administrador', 'gerencia'],
    reportes:    ['administrador', 'gerencia'],
    metricas_ia: ['administrador', 'gerencia'],
    usuario:     ['administrador'],
};

export default function Sistema({ onLogout }: SistemaProps) {
    const [view, setView] = useState<SystemView>('overview');
    const [collapsed, setCollapsed] = useState(window.innerWidth < 1024);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { hasAnyRole } = useUser();


    // Guardia: si la vista actual ya no es accesible, volver al resumen
    useEffect(() => {
        const allowed = RESTRICTED_VIEWS[view];
        if (allowed && !hasAnyRole(allowed)) {
            setView('overview');
        }
    }, [view, hasAnyRole]);

    // Navegación con guardia
    const handleNavigate = (v: SystemView) => {
        const allowed = RESTRICTED_VIEWS[v];
        if (allowed && !hasAnyRole(allowed)) return; // silencioso — el botón ya no debería aparecer
        setView(v);
        setMobileOpen(false);
    };

    const renderView = () => {
        // Doble verificación por seguridad
        const allowed = RESTRICTED_VIEWS[view];
        if (allowed && !hasAnyRole(allowed)) return <Overview />;

        switch (view) {
            case 'overview':           return <Overview />;
            case 'ticket':             return <Ticket />;
            case 'transportista':      return <Transportista />;
            case 'vehiculo':           return <Vehiculo />;
            case 'cliente':            return <Cliente />;
            case 'catalogos':          return <Catalogos />;
            case 'extra':              return <Extra />;
            case 'trabajo_maquinaria': return <TrabajoMaquinaria />;
            case 'reportes':           return <Reportes />;
            case 'metricas_ia':        return <MetricasIA />;
            case 'usuario':            return <Usuario />;
            case 'pago':               return <Pago />;
        }
    };

    return (
        <>
            <div className="flex h-screen bg-gray-50 overflow-hidden">
                <div className={`md:hidden fixed inset-0 bg-black/50 z-30 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileOpen(false)} />
                <div className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 md:relative md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <Sidebar
                        currentView={view}
                        onNavigate={handleNavigate}
                        onLogout={onLogout}
                        collapsed={collapsed}
                        onToggleCollapse={() => setCollapsed(c => !c)}
                    />
                </div>
                <main
                    className="flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 relative"
                >
                    <button onClick={() => setMobileOpen(true)} className="md:hidden absolute top-4 left-4 z-20 p-2 bg-white rounded-lg shadow-md border border-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                    <div key={view} className="flex-1 flex flex-col overflow-hidden">
                        {renderView()}
                    </div>
                </main>
            </div>
        </>
    );
}
