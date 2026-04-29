import { useState, useEffect } from 'react';
import Header from '../layout/Header';
import { Plus, Search, Edit, Trash2, Users, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Cliente, Vehiculo, ClienteCubicaje } from '../types';

export default function Clientes() {
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<Partial<Cliente>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
    const [loading, setLoading] = useState(true);

    // Cubicajes State
    const [showCubicajeModal, setShowCubicajeModal] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [cubicajes, setCubicajes] = useState<Record<number, number>>({}); // veh_id -> ccu_cubicaje
    const [cubicajeModalMode, setCubicajeModalMode] = useState<'view' | 'edit'>('view');
    const [editCubicajes, setEditCubicajes] = useState<Record<number, number>>({});

    useEffect(() => {
        fetchClientes();
        fetchVehiculos();
    }, []);

    const fetchClientes = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('cliente').select('*').order('cli_id', { ascending: false });
        if (error) console.error('Error fetching clientes:', error);
        else setClientes((data as Cliente[]) || []);
        setLoading(false);
    };

    const fetchVehiculos = async () => {
        const { data, error } = await supabase.from('vehiculo').select(`
            *,
            transportista:tra_id ( tra_nombre, tra_apellido )
        `);
        if (error) console.error('Error fetching vehiculos:', error);
        else setVehiculos((data as any[]) || []);
    };

    const fetchCubicajes = async (cli_id: number) => {
        const { data, error } = await supabase.from('cliente_cubicaje').select('*').eq('cli_id', cli_id);
        if (error) {
            console.error('Error fetching cubicajes:', error);
            return;
        }
        const cubicajesMap: Record<number, number> = {};
        (data as ClienteCubicaje[]).forEach(c => {
            cubicajesMap[c.veh_id] = c.ccu_cubicaje;
        });
        setCubicajes(cubicajesMap);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', cliente?: Cliente) => {
        setFormErrors({});
        setModalMode(mode);
        if (cliente) setFormData(cliente);
        else setFormData({ cli_estado: 'activo' });
        setShowForm(true);
    };

    const handleOpenCubicajes = async (cliente: Cliente) => {
        setSelectedCliente(cliente);
        setCubicajeModalMode('view');
        setShowCubicajeModal(true);
        setCubicajes({});
        await fetchCubicajes(cliente.cli_id);
    };

    const handleEditCubicajes = () => {
        setEditCubicajes({ ...cubicajes });
        setCubicajeModalMode('edit');
    };

    const handleSaveCubicajes = async () => {
        if (!selectedCliente) return;

        // Find which to delete, insert, update
        const toDelete: number[] = [];
        const toUpsert: { cli_id: number, veh_id: number, ccu_cubicaje: number }[] = [];

        // Any existing cubicaje not in editCubicajes should be deleted
        Object.keys(cubicajes).forEach(vehIdStr => {
            const vehId = parseInt(vehIdStr);
            if (editCubicajes[vehId] === undefined) {
                toDelete.push(vehId);
            }
        });

        // Any entry in editCubicajes must be upserted
        Object.entries(editCubicajes).forEach(([vehIdStr, m3]) => {
            toUpsert.push({
                cli_id: selectedCliente.cli_id,
                veh_id: parseInt(vehIdStr),
                ccu_cubicaje: m3
            });
        });

        if (toDelete.length > 0) {
            await supabase.from('cliente_cubicaje')
                .delete()
                .eq('cli_id', selectedCliente.cli_id)
                .in('veh_id', toDelete);
        }

        if (toUpsert.length > 0) {
            await supabase.from('cliente_cubicaje').upsert(toUpsert, { onConflict: 'cli_id,veh_id' });
        }

        await fetchCubicajes(selectedCliente.cli_id);
        setCubicajeModalMode('view');
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Está seguro de eliminar este cliente?')) {
            const { error } = await supabase.from('cliente').delete().eq('cli_id', id);
            if (error) alert('Error: ' + error.message);
            else fetchClientes();
        }
    };

    const handleSave = async () => {
        const errors: Record<string, string> = {};

        if (!formData.cli_nombre) errors.cli_nombre = 'Este campo es obligatorio';
        if (!formData.cli_correo) errors.cli_correo = 'Este campo es obligatorio';
        if (!formData.cli_telefono) errors.cli_telefono = 'Este campo es obligatorio';
        if (!formData.cli_estado) errors.cli_estado = 'Este campo es obligatorio';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        if (modalMode === 'create') {
            const { error } = await supabase.from('cliente').insert([{
                cli_nombre: formData.cli_nombre,
                cli_correo: formData.cli_correo,
                cli_telefono: formData.cli_telefono,
                cli_estado: formData.cli_estado || 'activo'
            }]);

            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchClientes();
            }
        } else {
            const { error } = await supabase.from('cliente').update({
                cli_nombre: formData.cli_nombre,
                cli_correo: formData.cli_correo,
                cli_telefono: formData.cli_telefono,
                cli_estado: formData.cli_estado
            }).eq('cli_id', formData.cli_id);

            if (error) alert('Error: ' + error.message);
            else {
                setShowForm(false);
                fetchClientes();
            }
        }
    };

    const rows = clientes.filter(c =>
        `${c.cli_nombre} ${c.cli_correo}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Header title="Clientes" subtitle="Empresas y entidades que contratan servicios de la cooperativa" />

            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Clientes', value: clientes.length, bg: 'bg-amber-50', color: 'text-amber-600' },
                        { label: 'Activos', value: clientes.filter(c => c.cli_estado === 'activo').length, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                        { label: 'Inactivos', value: clientes.filter(c => c.cli_estado === 'inactivo').length, bg: 'bg-red-50', color: 'text-red-500' },
                    ].map((c) => (
                        <div
                            key={c.label}
                            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover-card-premium"
                        >
                            <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                <Users size={20} className={c.color} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Herramientas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o correo…"
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95 ripple-effect"
                    >
                        <Plus size={18} /> Nuevo Cliente
                    </button>
                </div>

                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={modalMode === 'create' ? "Registrar Nuevo Cliente / Empresa" : modalMode === 'edit' ? "Editar Cliente" : "Detalles del Cliente"}
                    maxWidth="md"
                >
                    <div className="space-y-6">
                        <fieldset disabled={modalMode === 'view'} className="space-y-6 group">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Razón Social / Nombre Completo</label>
                                    <input
                                        value={formData.cli_nombre || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, cli_nombre: e.target.value });
                                            if (formErrors.cli_nombre) setFormErrors({});
                                        }}
                                        type="text"
                                        className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.cli_nombre ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="Ej. Constructora del Norte S.A."
                                    />
                                    {formErrors.cli_nombre && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.cli_nombre}</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Correo Electrónico <span className="text-red-500"></span></label>
                                    <input
                                        value={formData.cli_correo || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, cli_correo: e.target.value });
                                            if (formErrors.cli_correo) setFormErrors({ ...formErrors, cli_correo: '' });
                                        }}
                                        type="email"
                                        className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.cli_correo ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="empresa@contacto.com"
                                    />
                                    {formErrors.cli_correo && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.cli_correo}</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Teléfono Móvil <span className="text-red-500"></span></label>
                                    <input
                                        value={formData.cli_telefono || ''}
                                        onChange={e => {
                                            setFormData({ ...formData, cli_telefono: e.target.value });
                                            if (formErrors.cli_telefono) setFormErrors({ ...formErrors, cli_telefono: '' });
                                        }}
                                        type="tel"
                                        className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.cli_telefono ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                        placeholder="Ej. 0991234567"
                                    />
                                    {formErrors.cli_telefono && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.cli_telefono}</p>}
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado Inicial</label>
                                    <select
                                        value={formData.cli_estado || 'activo'}
                                        onChange={e => {
                                            setFormData({ ...formData, cli_estado: e.target.value as any });
                                            if (formErrors.cli_estado) setFormErrors({ ...formErrors, cli_estado: '' });
                                        }}
                                        className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer font-bold ${formErrors.cli_estado ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    >
                                        <option value="activo">ACTIVO</option>
                                        <option value="inactivo">INACTIVO</option>
                                    </select>
                                    {formErrors.cli_estado && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.cli_estado}</p>}
                                </div>
                            </div>

                        </fieldset>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100">
                            {modalMode === 'view' ? (
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold transition-all"
                                >
                                    Cerrar Detalles
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button onClick={handleSave} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                        {modalMode === 'create' ? 'Registrar Cliente' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                {/* Modal Cubicajes */}
                <Modal
                    isOpen={showCubicajeModal}
                    onClose={() => setShowCubicajeModal(false)}
                    title={`Cubicajes Acordados: ${selectedCliente?.cli_nombre}`}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Configure el cubicaje específico (en m³) que este cliente reconoce para cada vehículo. Si no se configura, se usará el cubicaje por defecto de la volqueta al registrar tickets.
                        </p>

                        <div className="border border-gray-100 rounded-xl overflow-hidden mt-4 max-h-[300px] overflow-y-auto scrollbar-hide">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-2">Placa de Vehículo</th>
                                        <th className="px-4 py-2">Transportista</th>
                                        <th className="px-4 py-2 text-right">Cubicaje Acordado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {cubicajeModalMode === 'view' ? (
                                        Object.entries(cubicajes).length === 0 ? (
                                            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">No hay cubicajes configurados para este cliente.</td></tr>
                                        ) : (
                                            Object.entries(cubicajes).map(([vehId, m3]) => {
                                                const volq = vehiculos.find(v => v.veh_id.toString() === vehId);
                                                return (
                                                    <tr key={vehId} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-3 font-mono font-bold text-gray-800">{volq?.veh_placa || `ID: ${vehId}`}</td>
                                                        <td className="px-4 py-3 text-gray-500 text-xs">{volq?.transportista ? `${volq.transportista.tra_nombre} ${volq.transportista.tra_apellido}` : '—'}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-indigo-600">{m3} m³</td>
                                                    </tr>
                                                );
                                            })
                                        )
                                    ) : (
                                        vehiculos.map(v => (
                                            <tr key={v.veh_id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-2 font-mono font-bold text-gray-800">{v.veh_placa}</td>
                                                <td className="px-4 py-2 text-gray-500 text-xs">{v.transportista ? `${v.transportista.tra_nombre} ${v.transportista.tra_apellido}` : ''}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <div className="flex justify-end">
                                                        <div className="relative w-28">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={editCubicajes[v.veh_id] || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    const newEdits = { ...editCubicajes };
                                                                    if (val === '') {
                                                                        delete newEdits[v.veh_id];
                                                                    } else {
                                                                        newEdits[v.veh_id] = parseFloat(val);
                                                                    }
                                                                    setEditCubicajes(newEdits);
                                                                }}
                                                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white pr-8"
                                                                placeholder="0.0"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-[11px]">m³</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100 mt-4">
                            {cubicajeModalMode === 'view' ? (
                                <>
                                    <button
                                        onClick={() => setShowCubicajeModal(false)}
                                        className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200"
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        onClick={handleEditCubicajes}
                                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        Editar Cubicajes
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setCubicajeModalMode('view')}
                                        className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveCubicajes}
                                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        Guardar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                {/* Tabla */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando clientes...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        <th className="text-left px-5 py-3">Nombre</th>
                                        <th className="text-left px-4 py-3 w-[250px]">Correo</th>
                                        <th className="text-left px-4 py-3 w-[150px]">Teléfono</th>
                                        <th className="text-center px-4 py-3 w-[120px]">Cubicajes</th>
                                        <th className="text-center px-4 py-3 w-[100px]">Estado</th>
                                        <th className="text-center px-2 py-3 w-[90px]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-gray-500">No se encontraron clientes</td></tr>
                                    ) : rows.map((c, idx) => {
                                        const avatarColors = ['bg-emerald-100 text-emerald-700', 'bg-red-100 text-red-700', 'bg-amber-100 text-amber-700'][idx % 3];
                                        return (
                                            <tr key={c.cli_id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full ${avatarColors} flex items-center justify-center flex-shrink-0`}>
                                                            <span className="text-xs font-bold">{c.cli_nombre.charAt(0)}</span>
                                                        </div>
                                                        <span className="font-medium text-gray-800">{c.cli_nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 truncate" title={c.cli_correo}>{c.cli_correo || '—'}</td>
                                                <td className="px-4 py-3 text-gray-800 font-medium">{c.cli_telefono || '—'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleOpenCubicajes(c)} className="p-1.5 px-3 text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all shadow-sm">Configurar</button>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.cli_estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                        {c.cli_estado}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button onClick={() => handleOpenModal('view', c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver"><Eye size={13} /></button>
                                                        <button onClick={() => handleOpenModal('edit', c)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit size={13} /></button>
                                                        <button onClick={() => handleDelete(c.cli_id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={13} /></button>
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
