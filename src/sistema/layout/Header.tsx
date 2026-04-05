import { useState, useRef, useEffect } from 'react';
import { Bell, Calendar, ChevronDown, LogOut, User, Settings, Edit } from 'lucide-react';
import { useUser } from '../UserContext';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export default function Header({ title, subtitle, children }: HeaderProps) {
    const { user, logout } = useUser();
    const email = user?.email || 'usuario@sistema.com';
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    const [showNotifications, setShowNotifications] = useState(false);
    const [notificaciones, setNotificaciones] = useState<any[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);

    /* Cerrar dropdown al hacer click fuera */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-EC', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    /* Nombre a mostrar: del metadata de Supabase, o parte del email como fallback */
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    const emailFallback = email.includes('@')
        ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : email;
    const initials = (metaName || emailFallback).charAt(0).toUpperCase();

    const [isEditing, setIsEditing] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [saveMessage, setSaveMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
    const [userData, setUserData] = useState({
        nombre: metaName || emailFallback,
        correo: email,
        estado: 'activo',
        creado_en: user?.created_at || new Date().toISOString()
    });

    // Fetch real name from 'usuario' table using the logged-in email
    useEffect(() => {
        if (!email || email === 'usuario@sistema.com') return;
        supabase
            .from('usuario')
            .select('usr_nombre, usr_estado')
            .eq('usr_correo', email)
            .single()
            .then(({ data }) => {
                if (data?.usr_nombre) {
                    setUserData(prev => ({
                        ...prev,
                        nombre: data.usr_nombre,
                        estado: data.usr_estado || 'activo',
                        correo: user?.email || prev.correo,
                        creado_en: user?.created_at || prev.creado_en,
                    }));
                } else {
                    // fallback: use metadata or email-derived name
                    setUserData(prev => ({
                        ...prev,
                        nombre: metaName || emailFallback,
                        correo: user?.email || prev.correo,
                        creado_en: user?.created_at || prev.creado_en,
                    }));
                }
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Fetch notificaciones recientes
    useEffect(() => {
        const fetchNotificaciones = async () => {
            const { data } = await supabase
                .from('notificacion_alerta')
                .select('nal_id, nal_tipo, nal_nivel_riesgo, nal_placa, nal_enviada_en, nal_mensaje')
                .order('nal_id', { ascending: false })
                .limit(3);
            if (data) {
                setNotificaciones(data);
            }
        };
        fetchNotificaciones();

        // Suscripción en tiempo real a nuevas alertas
        const channel = supabase.channel('realtime-notif')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacion_alerta' }, (payload) => {
                setNotificaciones(prev => {
                    const newNotif = payload.new;
                    // Agregar la nueva notificación y mantener máximo 3
                    return [newNotif, ...prev].slice(0, 3);
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);


    const handleSave = async () => {
        setSaveMessage(null);
        try {
            const updates: { email?: string; password?: string; data?: Record<string, any> } = {};
            if (userData.correo && userData.correo !== email) {
                updates.email = userData.correo;
            }
            if (newPassword && newPassword.length >= 6) {
                updates.password = newPassword;
            } else if (newPassword && newPassword.length > 0 && newPassword.length < 6) {
                setSaveMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
                return;
            }
            // Always save the name to user metadata
            updates.data = { full_name: userData.nombre };

            const { error } = await supabase.auth.updateUser(updates);
            if (error) {
                setSaveMessage({ type: 'error', text: error.message });
                return;
            }

            setNewPassword('');
            setIsEditing(false);
            setSaveMessage({ type: 'success', text: '¡Perfil actualizado correctamente!' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err: any) {
            setSaveMessage({ type: 'error', text: err.message || 'Error al guardar cambios.' });
        }
    };

    return (
        <header className="bg-white wave-border pl-16 md:pl-6 pr-4 sm:pr-6 py-3 sm:py-3.5 flex items-center justify-between shadow-sm flex-shrink-0 min-w-0">
            {/* Título */}
            <div className="min-w-0 flex-1 mr-2">
                <h1 className="text-base sm:text-xl font-black text-gray-900 leading-tight tracking-tight truncate">{title}</h1>
                {subtitle && <p className="hidden sm:block text-[11px] font-bold text-gray-400 mt-0.5 uppercase tracking-wider truncate">{subtitle}</p>}
            </div>

            {/* Controles derechos */}
            <div className="flex items-center gap-3">


                {/* Fecha */}
                <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold text-gray-500 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
                    <Calendar size={13} className="text-indigo-500 flex-shrink-0" />
                    <span className="capitalize">{dateStr}</span>
                </div>

                {/* Campana */}
                <div className="relative" ref={notifRef}>
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-white hover:shadow-md transition-all group flex-shrink-0"
                    >
                        <Bell size={16} className="text-gray-500 group-hover:text-amber-500 transition-colors" />
                        {notificaciones.length > 0 && (
                            <span className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100/50 py-2 z-50 animate-slide-down">
                            <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Notificaciones</h3>
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{notificaciones.length}</span>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notificaciones.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-xs text-gray-400">No hay notificaciones recientes</div>
                                ) : (
                                    notificaciones.map(notif => (
                                        <div key={notif.nal_id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-default">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                                    notif.nal_nivel_riesgo === 'ALTO' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    Riesgo {notif.nal_nivel_riesgo}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-bold">{new Date(notif.nal_enviada_en).toLocaleDateString('es-EC', { day:'2-digit', month:'short' })}</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-gray-800 mb-1 leading-tight">
                                                {notif.nal_tipo === 'despachado_con_alerta' ? 'Despacho con Alerta' : 'Viaje Pospuesto'} - Vehículo {notif.nal_placa}
                                            </p>
                                            <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{notif.nal_mensaje}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Chip usuario */}
                <div className="relative" ref={dropRef}>
                    <button
                        onClick={() => setDropdownOpen(v => !v)}
                        className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-md rounded-xl pl-2 pr-3 py-1.5 transition-all outline-none"
                    >
                        <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-100">
                            <span className="text-white text-xs font-bold">{initials}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 hidden sm:block max-w-[120px] truncate">
                            {userData.nombre}
                        </span>
                        <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform duration-300 ${dropdownOpen ? 'rotate-180 text-rose-500' : ''}`}
                        />
                    </button>

                    {/* Dropdown */}
                    {dropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100/50 py-2.5 z-50 animate-slide-down overflow-hidden">
                            <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50 mb-1">
                                <p className="text-xs font-black text-gray-900 truncate uppercase tracking-widest">{userData.nombre}</p>
                                <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">{userData.correo}</p>
                            </div>
                            <button
                                onClick={() => { setShowProfile(true); setDropdownOpen(false); setIsEditing(false); }}
                                className="w-full flex items-center gap-3 px-5 py-2.5 text-xs font-bold text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all group"
                            >
                                <User size={14} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
                                Mi Perfil
                            </button>

                            <div className="border-t border-gray-50 mt-1 pt-1 px-2">
                                <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                    <LogOut size={14} />
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modales de Perfil y Configuración */}
                <Modal
                    isOpen={showProfile}
                    onClose={() => setShowProfile(false)}
                    title={isEditing ? "Configuración de Perfil" : "Detalles de Cuenta"}
                    maxWidth="lg"
                >
                    <div className="space-y-3 animate-fade-in text-gray-900">
                        {/* Sección de Datos Personales */}
                        <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-lg shadow-gray-200/40 relative overflow-hidden group hover:border-rose-100/50 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-50 to-transparent -mr-12 -mt-12 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />

                            <div className="relative space-y-3">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-6 h-1 bg-rose-500 rounded-full" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Información General</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nombre Completo</label>
                                        {isEditing ? (
                                            <input
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all"
                                                value={userData.nombre}
                                                onChange={(e) => setUserData({ ...userData, nombre: e.target.value })}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 bg-gray-50/50 px-3 py-2 rounded-xl border border-transparent hover:border-gray-100 transition-colors">
                                                <User size={14} className="text-rose-500" />
                                                <p className="text-sm font-bold text-gray-700">{userData.nombre}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider ml-1">Correo Electrónico</label>
                                        {isEditing ? (
                                            <input
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all"
                                                value={userData.correo}
                                                onChange={(e) => setUserData({ ...userData, correo: e.target.value })}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 bg-gray-50/50 px-3 py-2 rounded-xl border border-transparent hover:border-gray-100 transition-colors min-w-0">
                                                <Bell size={14} className="text-sky-500 flex-shrink-0" />
                                                <p className="text-sm font-bold text-gray-700 truncate min-w-0" title={userData.correo}>{userData.correo}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Seguridad y Acceso */}
                        <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-lg shadow-gray-200/40 group hover:border-indigo-100/50 transition-all duration-500">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-6 h-1 bg-indigo-500 rounded-full" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Seguridad y Acceso</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider ml-1">Contraseña</label>
                                    {isEditing ? (
                                        <div className="relative">
                                            <input
                                                type="password"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                                                placeholder="Nueva contraseña (mín. 6 caracteres)"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                            <Settings size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between bg-gray-50/50 px-3 py-2 rounded-xl">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                                <p className="text-sm font-bold text-gray-700 tracking-[0.4em]">••••••••</p>
                                            </div>
                                            <span className="text-[8px] font-black text-indigo-400 uppercase">Protegida</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider ml-1">Estado de Cuenta</label>
                                    <div className="flex items-center justify-between bg-emerald-50/50 px-3 py-2 rounded-xl border border-emerald-100/30">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <p className="text-sm font-bold text-emerald-700 capitalize">{userData.estado}</p>
                                        </div>
                                        <div className="px-1.5 py-0.5 bg-emerald-500/10 rounded-md">
                                            <span className="text-[9px] font-black text-emerald-600 uppercase">Activa</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info secundaria: Fecha Registro */}
                        <div className="flex items-center justify-center gap-3 px-2">
                            <div className="h-px bg-gray-100 flex-1" />
                            <div className="flex items-center gap-1.5">
                                <Calendar size={10} className="text-gray-300" />
                                <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                                    Usuario desde {new Date(userData.creado_en).toLocaleDateString('es-EC', { month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="h-px bg-gray-100 flex-1" />
                        </div>

                        {/* Mensaje de feedback */}
                        {saveMessage && (
                            <div className={`px-4 py-2.5 rounded-xl text-[11px] font-bold text-center transition-all ${
                                saveMessage.type === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                                {saveMessage.text}
                            </div>
                        )}

                        {/* Footer con Botones Compactos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={() => { isEditing ? (setIsEditing(false), setNewPassword(''), setSaveMessage(null)) : setShowProfile(false); }}
                                className="order-2 sm:order-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all active:scale-[0.98]"
                            >
                                {isEditing ? 'Cancelar cambios' : 'Cerrar ventana'}
                            </button>

                            {isEditing ? (
                                <button
                                    onClick={handleSave}
                                    className="order-1 sm:order-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    Guardar Configuración
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="order-1 sm:order-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gray-900 hover:bg-black shadow-xl shadow-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                                >
                                    <Edit size={12} className="group-hover:rotate-12 transition-transform" />
                                    Gestionar Perfil
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>


                {children}
            </div>
        </header>
    );
}
