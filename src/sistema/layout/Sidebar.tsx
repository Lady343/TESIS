import {
    LayoutDashboard, Ticket, Users, Truck, UserCheck,
    Wrench, BarChart3, ShieldCheck,
    LogOut, ChevronLeft, ChevronRight, Hammer, CreditCard, FolderOpen, Brain
} from 'lucide-react';
import { SystemView } from '../types';
import { useUser } from '../UserContext';

interface SidebarProps {
    currentView: SystemView;
    onNavigate: (view: SystemView) => void;
    onLogout: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
}

// allowedRoles: undefined = visible para todos los roles autenticados
const NAV_ITEMS: {
    id: SystemView;
    label: string;
    icon: React.ElementType;
    group: string;
    allowedRoles?: string[];
}[] = [
    { id: 'overview',          label: 'Resumen',       icon: LayoutDashboard, group: '' },
    { id: 'ticket',            label: 'Tickets',        icon: Ticket,          group: 'Operaciones' },
    { id: 'pago',              label: 'Pagos',          icon: CreditCard,      group: 'Operaciones', allowedRoles: ['administrador', 'gerencia'] },
    { id: 'extra',             label: 'Extras',         icon: Hammer,          group: 'Operaciones' },
    { id: 'trabajo_maquinaria',label: 'Maquinaria',     icon: Wrench,          group: 'Operaciones' },
    { id: 'transportista',     label: 'Transportistas', icon: UserCheck,       group: 'Gestión' },
    { id: 'vehiculo',          label: 'Vehículos',      icon: Truck,           group: 'Gestión' },
    { id: 'cliente',           label: 'Clientes',       icon: Users,           group: 'Gestión' },
    { id: 'catalogos',         label: 'Recursos',       icon: FolderOpen,      group: 'Catálogos' },
    { id: 'reportes',          label: 'Reportes',       icon: BarChart3,       group: 'Análisis',   allowedRoles: ['administrador', 'gerencia'] },
    { id: 'metricas_ia',       label: 'Métricas IA',    icon: Brain,           group: 'Análisis',   allowedRoles: ['administrador', 'gerencia'] },
    { id: 'usuario',           label: 'Usuarios',       icon: ShieldCheck,     group: 'Sistema',    allowedRoles: ['administrador'] },
];

const GROUPS = ['', 'Operaciones', 'Gestión', 'Catálogos', 'Análisis', 'Sistema'];



export default function Sidebar({
    currentView, onNavigate, onLogout, collapsed, onToggleCollapse
}: SidebarProps) {
    const { roles } = useUser();

    // Filtra los ítems según el rol del usuario
    const visibleItems = NAV_ITEMS.filter(item => {
        if (!item.allowedRoles) return true; // visible para todos
        return item.allowedRoles.some(r => roles.includes(r));
    });

    return (
        <aside
            className="h-full flex flex-col z-40 transition-all duration-300 shadow-2xl relative"
            style={{
                width: collapsed ? '72px' : '260px',
                background: 'linear-gradient(160deg, #0d1b2a 0%, #0a1628 40%, #060e1a 100%)',
                boxShadow: '4px 0 24px rgba(10,30,80,0.5)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center px-4 py-5 border-b border-white/10 min-h-[72px]">
                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-lg border border-white/10">
                        <img src="/LOGO_PESADA.png" alt="Logo" className="w-8 h-8 object-contain" />
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">COOP. CENTRAL</p>
                            <p className="text-white font-bold text-sm leading-tight whitespace-nowrap uppercase">SHUSHUFINDI</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={onToggleCollapse}
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-emerald-500 flex items-center justify-center transition-all duration-200 text-white ml-2"
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-3 overflow-x-hidden scrollbar-hide">
                {GROUPS.map(group => {
                    const items = visibleItems.filter(i => i.group === group);
                    if (!items.length) return null;
                    return (
                        <div key={group || '__root'} className="mb-1">
                            {group && !collapsed && (
                                <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-white/30 font-semibold select-none">
                                    {group}
                                </p>
                            )}
                            {items.map(item => {
                                const Icon = item.icon;
                                const active = currentView === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onNavigate(item.id)}
                                        title={collapsed ? item.label : undefined}
                                        className={`
                    relative w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all duration-300 group ripple-effect
                    ${active ? 'text-white translate-x-1' : 'text-white/50 hover:text-white hover:translate-x-1'}
                  `}
                                        style={{
                                            borderRadius: '0 12px 12px 0',
                                            marginRight: '12px',
                                            width: 'calc(100% - 12px)',
                                            background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                                            boxShadow: active ? '0 2px 20px rgba(0,0,0,0.35)' : 'none',
                                        }}
                                    >
                                        {active && (
                                            <span
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full z-10"
                                                style={{
                                                    backgroundColor: '#ffffff',
                                                    boxShadow: '0 0 12px rgba(255,255,255,0.6)'
                                                }}
                                            />
                                        )}
                                        <Icon
                                            size={19}
                                            className={`flex-shrink-0 transition-transform duration-300 ${active ? 'scale-110 text-white' : 'group-hover:scale-110 group-hover:text-white'}`}
                                        />
                                        {!collapsed && <span className="whitespace-nowrap tracking-tight">{item.label}</span>}
                                        {collapsed && (
                                            <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900/95 backdrop-blur-md text-white text-[11px] font-bold rounded-lg
                      opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-all duration-300 translate-x-2 group-hover:translate-x-0 z-50 shadow-2xl border border-white/5">
                                                {item.label}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            {/* Rol badge + logout */}
            <div className="border-t border-white/10 p-3 space-y-1">
                {/* Mostrar rol activo */}
                {!collapsed && roles.length > 0 && (
                    <div className="px-3 py-1.5 mb-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Rol activo</p>
                        <p className="text-xs font-bold text-emerald-400 capitalize">{roles[0]}</p>
                    </div>
                )}
                <button
                    onClick={onLogout}
                    title={collapsed ? 'Cerrar Sesión' : undefined}
                    className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all duration-200 text-sm group ripple-effect"
                >
                    <LogOut size={18} className="flex-shrink-0 text-rose-400/80 group-hover:text-rose-400" />
                    {!collapsed && <span>Cerrar Sesión</span>}
                    {collapsed && (
                        <span className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-md
              opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                            Cerrar Sesión
                        </span>
                    )}
                </button>
            </div>


        </aside>
    );
}
