export type SystemView =
    | 'overview' | 'ticket' | 'transportista' | 'vehiculo'
    | 'cliente' | 'material' | 'extra' | 'trabajo_maquinaria'
    | 'lugar' | 'reportes' | 'usuario' | 'maquina_cooperativa'
    | 'pago' | 'catalogos' | 'metricas_ia';

export interface Usuario {
    usr_id: number;
    usr_nombre: string;
    usr_correo: string;
    usr_estado: 'activo' | 'inactivo';
    auth_user_id?: string;
    created_at?: string;
}

export interface Rol {
    rol_id: number;
    rol_nombre: 'administrador' | 'gerencia' | 'despachador';
}

export interface Transportista {
    tra_id: number;
    tra_nombre: string;
    tra_apellido: string;
    tra_tipo: 'socio' | 'particular';
    tra_estado: 'activo' | 'inactivo';
    tra_telefono?: string;   // número WhatsApp, ej: +593987654321|apikey
    tra_correo?: string;     // correo para notificaciones de alerta
    created_at?: string;
}

export interface Vehiculo {
    veh_id: number;
    veh_placa: string;
    veh_marca: string;
    veh_tipo: 'volqueta' | 'cabezal';
    veh_cubicaje: number;
    tra_id: number;
    veh_estado: 'activa' | 'inactiva';
    created_at?: string;
    
    // Virtual field for UI sometimes
    transportista?: Transportista;
}

export interface Lugar {
    lug_id: number;
    lug_nombre: string;
    lug_tipo: 'Mina' | 'Stock' | 'Constructora' | 'Otro';
    lug_latitud?: number;
    lug_longitud?: number;
    lug_estado: 'activo' | 'inactivo';
}

export interface Cliente {
    cli_id: number;
    cli_nombre: string;
    cli_correo?: string;
    cli_telefono?: string;
    cli_estado: 'activo' | 'inactivo';
}

export interface ClienteCubicaje {
    ccu_id: number;
    cli_id: number;
    veh_id: number;
    ccu_cubicaje: number;
}

export interface Material {
    mat_id: number;
    mat_nombre: string;
    mat_unidad: string;
    mat_categoria: string;
}

export interface Ticket {
    tic_id: number;
    tic_numero: string;
    tic_fecha: string;
    veh_id: number;
    mat_id: number;
    tic_cubicaje: number;
    lug_origen_id: number;
    lug_destino_id: number;
    tic_recorrido_km?: number;
    cli_id: number;
    tic_estado: 'despachado' | 'recibido' | 'anulado';
    tic_observaciones?: string;
    tic_nivel_riesgo: 'Bajo' | 'Medio' | 'Alto';
    tic_hora_despacho?: string;
    tic_tiempo_estimado_llegada?: string;
    tic_tiempo_real_llegada?: string;
    tic_tiempo_mora?: number | null;   // puede ser negativo (llegó antes)
    tic_precision?: number;            // Precisión exacta desde el modelo IA
    usr_creado_por?: number;
    created_at?: string;
}

export interface TicketDetalle extends Ticket {
    origen_nombre: string;
    destino_nombre: string;
    cliente_cubicaje: number;
    veh_placa?: string; // We might join these in UI
    veh_marca?: string;
    tra_nombre?: string;
    tra_apellido?: string;
    cli_nombre?: string;
    mat_nombre?: string;
}

export interface Pago {
    pag_id: number;
    pag_nro: string;
    pag_fecha: string;
    tic_id: number;
    pag_precio_unitario: number;
    pag_total: number;
    pag_observaciones?: string;
    usr_creado_por?: number;
}

export interface Extra {
    ext_id: number;
    ext_numero: string;
    ext_fecha: string;
    veh_id: number;
    ext_cubicaje: number;
    mat_id: number;
    ext_detalle?: string;
    lug_origen_id?: number;
    ext_precio: number;
    ext_estado: 'completado' | 'anulado';
    usr_creado_por?: number;
}

export interface MaquinaCooperativa {
    mac_id: number;
    mac_placa: string;
    mac_tipo: string;
    mac_marca: string;
    mac_modelo?: string;
    mac_estado: 'activa' | 'inactiva';
}

export interface TrabajoMaquinaria {
    trm_id: number;
    trm_nro_registro: string;
    trm_fecha: string;
    mac_id: number;
    cli_id?: number;
    trm_hora_inicial: string;
    trm_hora_final: string;
    trm_total_horas?: number;
    trm_valor_hora: number;
    trm_valor_facturar?: number;
    trm_estado: 'pendiente' | 'facturado' | 'anulado';
    usr_creado_por?: number;
}
