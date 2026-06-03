import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, Edit, Trash2, ShieldCheck, Eye, Search, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';

const ROL_BADGE: Record<string, string> = {
    administrador: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    gerencia: 'bg-red-100 text-red-700 border border-red-200',
    despachador: 'bg-amber-100 text-amber-700 border border-amber-200',
};

export default function Usuarios() {
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<any>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUsuarios();
    }, []);

    const fetchUsuarios = async () => {
        setLoading(true);
        // Hacemos el join con usuario_rol y rol para traer la información completa
        const { data, error } = await supabase
            .from('usuario')
            .select(`
                usr_id,
                usr_nombre,
                usr_correo,
                usr_estado,
                usuario_rol (
                    rol (
                        rol_nombre
                    )
                )
            `)
            .order('usr_id', { ascending: false });

        if (error) {
            console.error('Error fetching usuarios:', error);
        } else if (data) {
            // Mapeamos los datos para unificarlos en un solo nivel
            const mappedData = data.map((u: any) => {
                let rolName = 'sin rol';
                if (u.usuario_rol && u.usuario_rol.length > 0 && u.usuario_rol[0].rol) {
                    rolName = u.usuario_rol[0].rol.rol_nombre;
                }
                
                return {
                    id: u.usr_id,
                    nombre: u.usr_nombre,
                    correo: u.usr_correo,
                    estado: u.usr_estado,
                    rol: rolName,
                };
            });
            setUsuarios(mappedData);
        }
        setLoading(false);
    };

    const filteredUsuarios = usuarios.filter(u => 
        `${u.nombre} ${u.correo} ${u.rol}`.toLowerCase().includes(search.toLowerCase())
    );

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', usuario?: any) => {
        setFormErrors({});
        setModalMode(mode);
        if (usuario) setFormData(usuario);
        else setFormData({ rol: 'despachador', estado: 'activo' });
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Está seguro de eliminar este usuario? Esto no se puede deshacer.')) {
            // Eliminar de Supabase
            const { error } = await supabase.from('usuario').delete().eq('usr_id', id);
            if (error) {
                alert('Error al eliminar: ' + error.message);
            } else {
                fetchUsuarios();
            }
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};
        const requiredFields = ['nombre', 'correo', 'rol', 'estado'];
        
        if (modalMode === 'create') {
            requiredFields.push('password'); // Solo pedimos password al crear
        }

        requiredFields.forEach(field => {
            if (formData[field] === undefined || formData[field] === null || formData[field] === '') {
                errors[field] = 'Este campo es obligatorio';
            }
        });

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setSaving(true);

        if (modalMode === 'create') {
            // Llamar a la Edge Function
            const { data, error } = await supabase.functions.invoke('crear-usuario', {
                body: {
                    nombre: formData.nombre,
                    correo: formData.correo,
                    password: formData.password,
                    rol_nombre: formData.rol
                }
            });

            if (error) {
                alert('Error al crear usuario en Supabase Auth: ' + error.message);
                setSaving(false);
                return;
            }

            if (data?.error) {
                alert('Error del servidor: ' + data.error);
                setSaving(false);
                return;
            }

        } else {
            // Update mode: solo podemos actualizar el nombre y el estado en la tabla 'usuario'
            // Actualizar el correo o password requeriría otra edge function o llamadas auth admin
            const { error: userError } = await supabase.from('usuario').update({
                usr_nombre: formData.nombre,
                usr_estado: formData.estado
            }).eq('usr_id', formData.id);

            if (userError) {
                alert('Error al actualizar usuario: ' + userError.message);
                setSaving(false);
                return;
            }

            // Nota: Para cambiar el rol, tendríamos que buscar el rol_id y hacer update en usuario_rol
            // Por simplicidad en este MVP, asumiremos que si cambia el rol, se actualiza:
            const { data: rolData } = await supabase.from('rol').select('rol_id').eq('rol_nombre', formData.rol).single();
            if (rolData) {
                await supabase.from('usuario_rol').update({ rol_id: rolData.rol_id }).eq('usr_id', formData.id);
            }
        }

        setSaving(false);
        setShowForm(false);
        fetchUsuarios();
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Usuarios del Sistema" subtitle="Gestión de accesos y roles" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                {/* Resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Usuarios', value: usuarios.length, icon: ShieldCheck, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Activos', value: usuarios.filter(u => u.estado === 'activo').length, icon: ShieldCheck, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Inactivos', value: usuarios.filter(u => u.estado === 'inactivo').length, icon: ShieldCheck, bg: 'bg-red-50', color: 'text-red-500' },
                    ].map((c) => {
                        const Icon = c.icon;
                        return (
                            <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover-card-premium">
                                <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                    <Icon size={20} className={c.color} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-800 tracking-tight">{c.value}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Barra de Búsqueda y Acción */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, correo o rol..."
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95 ripple-effect"
                    >
                        <Plus size={18} /> Nuevo Usuario
                    </button>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={modalMode === 'create' ? "Crear Nueva Cuenta" : modalMode === 'edit' ? "Editar Cuenta" : "Detalles de Cuenta"}
                    maxWidth="lg"
                >
                    <div className="space-y-6">
                        {modalMode === 'create' && (
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-xl flex items-start gap-3 text-xs font-medium border border-blue-100">
                                <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-blue-500" />
                                <p>Este usuario se creará en el servicio de autenticación. Deberá proporcionarle la contraseña temporal al usuario.</p>
                            </div>
                        )}

                        <fieldset disabled={modalMode === 'view'} className="grid grid-cols-1 sm:grid-cols-2 gap-5 group">
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nombre Completo</label>
                                <input 
                                    value={formData.nombre || ''} 
                                    onChange={e => {
                                        setFormData({ ...formData, nombre: e.target.value });
                                        if (formErrors.nombre) setFormErrors({ ...formErrors, nombre: '' });
                                    }} 
                                    type="text" 
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.nombre ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`} 
                                    placeholder="Ej. Juan Pérez" 
                                />
                                {formErrors.nombre && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.nombre}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Correo Electrónico</label>
                                <input 
                                    value={formData.correo || ''} 
                                    onChange={e => {
                                        setFormData({ ...formData, correo: e.target.value });
                                        if (formErrors.correo) setFormErrors({ ...formErrors, correo: '' });
                                    }} 
                                    type="email" 
                                    disabled={modalMode === 'edit'}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 ${modalMode === 'edit' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white'} ${formErrors.correo ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`} 
                                    placeholder="correo@cooperativa.ec" 
                                />
                                {formErrors.correo && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.correo}</p>}
                            </div>

                            {modalMode === 'create' && (
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contraseña Temporal</label>
                                    <input 
                                        value={formData.password || ''} 
                                        onChange={e => {
                                            setFormData({ ...formData, password: e.target.value });
                                            if (formErrors.password) setFormErrors({ ...formErrors, password: '' });
                                        }} 
                                        type="text" 
                                        className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`} 
                                        placeholder="Min. 6 caracteres" 
                                    />
                                    {formErrors.password && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.password}</p>}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Asignar Rol</label>
                                <div className="relative">
                                    <select 
                                        value={formData.rol || 'despachador'} 
                                        onChange={e => {
                                            setFormData({ ...formData, rol: e.target.value });
                                            if (formErrors.rol) setFormErrors({ ...formErrors, rol: '' });
                                        }} 
                                        className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer ${formErrors.rol ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    >
                                        <option value="administrador">administrador</option>
                                        <option value="gerencia">gerencia</option>
                                        <option value="despachador">despachador</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <Plus size={14} className="rotate-45" />
                                    </div>
                                </div>
                                {formErrors.rol && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.rol}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado Inicial</label>
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                                    <button onClick={() => setFormData({ ...formData, estado: 'activo' })} type="button" className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${formData.estado === 'activo' ? 'bg-white text-emerald-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-white/50'}`}>Activo</button>
                                    <button onClick={() => setFormData({ ...formData, estado: 'inactivo' })} type="button" className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${formData.estado === 'inactivo' ? 'bg-white text-red-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-white/50'}`}>Inactivo</button>
                                </div>
                            </div>
                        </fieldset>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100">
                            <button
                                onClick={() => setShowForm(false)}
                                disabled={saving}
                                className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200 disabled:opacity-50"
                            >
                                {modalMode === 'view' ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {modalMode !== 'view' && (
                                <button disabled={saving} onClick={handleSave} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50">
                                    {saving ? 'Guardando...' : (modalMode === 'create' ? 'Crear Usuario Seguro' : 'Guardar Cambios')}
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando usuarios...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                                        <th className="text-left px-6 py-4">Usuario</th>
                                        <th className="text-left px-4 py-4">Correo</th>
                                        <th className="text-left px-4 py-4">Rol</th>
                                        <th className="text-left px-4 py-4">Estado</th>
                                        <th className="text-center px-4 py-4 w-[90px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredUsuarios.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-8 text-gray-500">No hay usuarios registrados</td></tr>
                                    ) : filteredUsuarios.map((u, idx) => {
                                        const avatarColors = ['bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-red-100 text-red-700'][idx % 3];
                                        return (
                                        <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full ${avatarColors} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                                                        <span className="text-sm font-black">{u.nombre.charAt(0).toUpperCase()}</span>
                                                    </div>
                                                    <span className="font-bold text-gray-800">{u.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-gray-500 font-medium">{u.correo}</td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${ROL_BADGE[u.rol] || 'bg-gray-100 text-gray-700'}`}>
                                                    <ShieldCheck size={14} />
                                                    {u.rol.charAt(0).toUpperCase() + u.rol.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider ${u.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                    {u.estado}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button onClick={() => handleOpenModal('view', u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                    <button onClick={() => handleOpenModal('edit', u)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                    <button onClick={() => handleDelete(u.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
