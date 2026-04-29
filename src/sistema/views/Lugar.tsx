import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, MapPin, Eye, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Modal from '../components/Modal';
import { supabase } from '../../lib/supabase';
import { Lugar } from '../types';

// Fix default marker icon broken by webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const TIPO_COLORS: Record<string, string> = {
    Mina: 'bg-amber-100 text-amber-600',
    Stock: 'bg-sky-100 text-sky-600',
    Constructora: 'bg-indigo-100 text-indigo-600',
    Otro: 'bg-slate-100 text-slate-500',
};

// Component to handle map click events
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function Lugares() {
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
    const [formData, setFormData] = useState<Partial<Lugar>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [lugares, setLugares] = useState<Lugar[]>([]);
    const [loading, setLoading] = useState(true);
    const [mapKey, setMapKey] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // Default center: Shushufindi, Ecuador
    const DEFAULT_CENTER: [number, number] = [-0.1871, -76.6450];
    const DEFAULT_ZOOM = 13;

    useEffect(() => {
        fetchLugares();
    }, []);

    const fetchLugares = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('lugar').select('*').order('lug_id', { ascending: true });
        if (error) {
            console.error('Error fetching lugares:', error);
        } else {
            setLugares((data as Lugar[]) || []);
        }
        setLoading(false);
    };

    const handleOpenModal = (mode: 'create' | 'edit' | 'view', lugar?: Lugar) => {
        setFormErrors({});
        setModalMode(mode);
        if (lugar) {
            setFormData(lugar);
        } else {
            setFormData({ lug_tipo: 'Mina', lug_estado: 'activo' });
        }
        // Remount map when opening
        setMapKey(prev => prev + 1);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Está seguro de eliminar esta ubicación?')) {
            const { error } = await supabase.from('lugar').delete().eq('lug_id', id);
            if (error) {
                alert('Error al eliminar: ' + error.message);
            } else {
                fetchLugares();
            }
        }
    };

    const handleLocationSelect = useCallback((lat: number, lng: number) => {
        setFormData(prev => ({ ...prev, lug_latitud: lat, lug_longitud: lng }));
    }, []);

    const handleSave = async () => {
        const errors: Record<string, string> = {};

        if (!formData.lug_nombre) errors.lug_nombre = 'Este campo es obligatorio';
        if (!formData.lug_tipo) errors.lug_tipo = 'Este campo es obligatorio';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        const payload = {
            lug_nombre: formData.lug_nombre,
            lug_tipo: formData.lug_tipo,
            lug_estado: formData.lug_estado || 'activo',
            lug_latitud: formData.lug_latitud ?? null,
            lug_longitud: formData.lug_longitud ?? null,
        };

        if (modalMode === 'create') {
            const { error } = await supabase.from('lugar').insert([payload]);
            if (error) alert('Error al crear: ' + error.message);
            else {
                setShowForm(false);
                fetchLugares();
            }
        } else {
            const { error } = await supabase.from('lugar').update(payload).eq('lug_id', formData.lug_id);
            if (error) alert('Error al actualizar: ' + error.message);
            else {
                setShowForm(false);
                fetchLugares();
            }
        }
    };

    const markerPos: [number, number] | null =
        formData.lug_latitud != null && formData.lug_longitud != null
            ? [formData.lug_latitud, formData.lug_longitud]
            : null;

    const mapCenter: [number, number] = markerPos ?? DEFAULT_CENTER;

    return (
        <div className="flex flex-col h-full">
            <div className="space-y-5">
                {/* Herramientas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex justify-between items-center gap-4">
                    {/* Búsqueda */}
                    <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 gap-2 flex-1 max-w-md">
                        <Search size={16} className="text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            className="bg-transparent text-sm text-gray-700 outline-none w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal('create')}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95 ripple-effect"
                    >
                        <Plus size={18} /> Nuevo Lugar
                    </button>
                </div>

                {/* Modal with Leaflet Map */}
                <Modal
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    title={modalMode === 'create' ? "Registrar Nueva Ubicación" : modalMode === 'edit' ? "Editar Ubicación" : "Detalles de la Ubicación"}
                    maxWidth="lg"
                >
                    <div className="space-y-5">
                        <fieldset disabled={modalMode === 'view'} className="grid grid-cols-1 sm:grid-cols-2 gap-4 group">
                            <div className="space-y-2 sm:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nombre del Lugar / Instalación <span className="text-red-500"></span></label>
                                <input
                                    value={formData.lug_nombre || ''}
                                    onChange={e => {
                                        setFormData({ ...formData, lug_nombre: e.target.value });
                                        if (formErrors.lug_nombre) setFormErrors({ ...formErrors, lug_nombre: '' });
                                    }}
                                    type="text"
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white ${formErrors.lug_nombre ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                    placeholder="Ej. Mina Central, Stock Victoria, Constructora Norte"
                                />
                                {formErrors.lug_nombre && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.lug_nombre}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Categoría / Tipo <span className="text-red-500"></span></label>
                                <select
                                    value={formData.lug_tipo || 'Mina'}
                                    onChange={e => {
                                        setFormData({ ...formData, lug_tipo: e.target.value as any });
                                        if (formErrors.lug_tipo) setFormErrors({ ...formErrors, lug_tipo: '' });
                                    }}
                                    className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 transition-all bg-gray-50/50 hover:bg-white appearance-none cursor-pointer ${formErrors.lug_tipo ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                                >
                                    <option value="Mina">Mina</option>
                                    <option value="Stock">Stock</option>
                                    <option value="Constructora">Constructora</option>
                                    <option value="Otro">Otro</option>
                                </select>
                                {formErrors.lug_tipo && <p className="text-xs text-red-500 font-medium mt-1">{formErrors.lug_tipo}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estado Operativo</label>
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                                    <button onClick={() => setFormData({ ...formData, lug_estado: 'activo' })} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${formData.lug_estado === 'activo' ? 'bg-white text-emerald-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-white/50'}`}>Activo</button>
                                    <button onClick={() => setFormData({ ...formData, lug_estado: 'inactivo' })} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${formData.lug_estado === 'inactivo' ? 'bg-white text-emerald-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-white/50'}`}>Inactivo</button>
                                </div>
                            </div>
                        </fieldset>

                        {/* Leaflet Map */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin size={12} className="text-sky-500" />
                                    Ubicación en el Mapa
                                    <span className="text-gray-300 font-normal normal-case tracking-normal">— Haz clic para marcar el punto exacto</span>
                                </label>
                                {markerPos && modalMode !== 'view' && (
                                    <button
                                        onClick={() => setFormData(prev => ({ ...prev, lug_latitud: undefined, lug_longitud: undefined }))}
                                        className="text-[10px] text-red-400 hover:text-red-600 font-semibold transition-colors"
                                    >
                                        Limpiar marcador
                                    </button>
                                )}
                            </div>

                            {/* Coordinates display */}
                            <div className="flex gap-3">
                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Lat</span>
                                    <span className="text-sm font-mono text-gray-700">
                                        {formData.lug_latitud != null ? formData.lug_latitud.toFixed(6) : '—'}
                                    </span>
                                </div>
                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Lng</span>
                                    <span className="text-sm font-mono text-gray-700">
                                        {formData.lug_longitud != null ? formData.lug_longitud.toFixed(6) : '—'}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '280px' }}>
                                <MapContainer
                                    key={mapKey}
                                    center={mapCenter}
                                    zoom={DEFAULT_ZOOM}
                                    style={{ height: '100%', width: '100%' }}
                                    scrollWheelZoom={true}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {modalMode !== 'view' && <MapClickHandler onLocationSelect={handleLocationSelect} />}
                                    {markerPos && <Marker position={markerPos} />}
                                </MapContainer>
                            </div>
                            <p className="text-[10px] text-gray-400 text-center">
                                Haz clic en cualquier punto del mapa para colocar el marcador
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100 mt-4">
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
                                        {modalMode === 'create' ? 'Guardar Ubicación' : 'Guardar Cambios'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Cargando lugares...</div>
                    ) : (
                        <div className="overflow-x-auto table-responsive">
                            <table className="w-full text-sm table-fixed min-w-[750px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                    <th className="text-left px-4 py-3 w-[70px]">ID</th>
                                    <th className="text-left px-3 py-3">Nombre del Lugar</th>
                                    <th className="text-center px-3 py-3 w-[130px]">Tipo</th>
                                    <th className="text-left px-3 py-3 w-[220px]">Coordenadas</th>
                                    <th className="text-center px-3 py-3 w-[110px]">Estado</th>
                                    <th className="text-center px-3 py-3 w-[90px]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {lugares.filter(l => l.lug_nombre.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No hay lugares registrados o que coincidan con la búsqueda</td></tr>
                                ) : lugares.filter(l => l.lug_nombre.toLowerCase().includes(searchTerm.toLowerCase())).map((l, idx) => {
                                    const colorClass = TIPO_COLORS[l.lug_tipo] || TIPO_COLORS['Otro'];
                                    const hasCoords = l.lug_latitud != null && l.lug_longitud != null;
                                    const rowColors = [
                                        'bg-emerald-100 text-emerald-700',
                                        'bg-red-100 text-red-700',
                                        'bg-amber-100 text-amber-700',
                                    ][idx % 3];
                                    return (
                                        <tr key={l.lug_id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${rowColors} font-bold text-xs`}>
                                                    {l.lug_id}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="font-bold text-gray-800 text-sm">{l.lug_nombre}</span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase ${colorClass}`}>
                                                    {l.lug_tipo}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                {hasCoords ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin size={13} className="text-sky-500 flex-shrink-0" />
                                                        <span className="font-mono text-xs text-gray-600">
                                                            {l.lug_latitud!.toFixed(4)}, {l.lug_longitud!.toFixed(4)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-300 italic">Sin coordenadas</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase ${l.lug_estado === 'activo' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                    {l.lug_estado}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button
                                                        onClick={() => handleOpenModal('view', l)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Ver"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal('edit', l)}
                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(l.lug_id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
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
