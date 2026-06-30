// ============================================================
//  Servicio de Predicción v4 — Tiempo + Riesgo de Atascamiento
//  Cooperativa Central Shushufindi
// ============================================================

// Usa el proxy de Vite (/api → http://127.0.0.1:8000) para evitar CORS en desarrollo.
// En producción, define VITE_API_PREDICCION_URL con la URL completa del backend.
const API_URL = import.meta.env.VITE_API_PREDICCION_URL || '/api';

/** Lo que el sistema envía a la API */
export interface DatosPrediccion {
  origen:        string;  // ej: "MINA PEÑAFIEL"
  destino:       string;  // ej: "STOCK VICTORIA"
  material:      string;  // ej: "ARENA"
  empresa:       string;  // ej: "PROCOPET"
  placa:         string;  // ej: "PCN3265"
  cubicaje:      number;  // ej: 11
  hora_despacho: string;  // ej: "08:30"
}

/**
 * Nivel de riesgo de ATASCAMIENTO que devuelve el modelo.
 * Reemplaza la antigua criticidad (TOLERABLE/MODERADO/CRITICO).
 * "SIN NOVEDAD" se devuelve cuando el origen no es una mina.
 */
export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'SIN NOVEDAD';

/** Alias de compatibilidad con código anterior */
export type NivelCriticidad = NivelRiesgo;

/** Lo que devuelve la API */
export interface ResultadoPrediccion {
  tiempo_estimado_minutos: number;
  hora_estimada_llegada:   string;            // "HH:MM"
  nivel_riesgo:            NivelRiesgo;
  precision_ia?:           number;
  /** lluvia real usada (mm) y el indice de humedad de 3 dias */
  detalle_clima:           { lluvia_hoy?: number; lluvia_ayer?: number; lluvia_antier?: number; indice_humedad?: number };
  aviso:                   string;            // texto de apoyo a la decisión
  /** de dónde salió el clima: "vivo" (Open-Meteo), "promedio_mes" o "no-mina" */
  fuente_clima?:           string;
  /** alias de compatibilidad */
  nivel_criticidad:        NivelRiesgo;
}

/**
 * Llama a la API Python v4. La API arma internamente las variables
 * (clima promedio del mes, antigüedad del vehículo, tiempo típico de la ruta,
 * historial de riesgo) y devuelve el tiempo estimado y el nivel de riesgo de
 * atascamiento del viaje.
 */
export async function predecirTiempoViaje(
  datos: DatosPrediccion
): Promise<ResultadoPrediccion> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/predecir`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(datos),
      signal:  controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Error del servidor: ${response.status}`);
    }

    const res = await response.json();
    const nivel: NivelRiesgo = res.nivel_riesgo ?? 'SIN NOVEDAD';

    return {
      tiempo_estimado_minutos: res.tiempo_estimado_minutos,
      hora_estimada_llegada:   res.hora_llegada_estimada,
      nivel_riesgo:            nivel,
      precision_ia:            res.precision_ia,
      detalle_clima:           res.detalle_clima ?? {},
      aviso:                   res.aviso ?? '',
      fuente_clima:            res.fuente_clima,
      nivel_criticidad:        nivel, // compatibilidad
    };

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('La API tardó demasiado (>10s). ¿Está corriendo uvicorn en el puerto 8000?');
      }
      throw error;
    }
    throw new Error('Error desconocido al conectar con la API');
  } finally {
    clearTimeout(timeout);
  }
}

/** Color sugerido para mostrar el nivel en la interfaz (semáforo) */
export function colorRiesgo(nivel: NivelRiesgo): string {
  switch (nivel) {
    case 'BAJO':        return '#2e7d32'; // verde
    case 'MEDIO':       return '#f9a825'; // amarillo
    case 'ALTO':        return '#c62828'; // rojo
    case 'SIN NOVEDAD': return '#607d8b'; // gris (no aplica)
    default:            return '#90a4ae';
  }
}

/** Alias de compatibilidad con código anterior */
export const colorCriticidad = colorRiesgo;

/** Verifica si la API está activa */
export async function verificarApiActiva(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────
//  Notificaciones de alerta al dueño del vehículo
// ────────────────────────────────────────────────────────────

export interface DatosNotificacion {
  tipo:                'despachado_con_alerta' | 'pendiente';
  tic_id:              number;
  tic_numero:          string;
  tic_hora_despacho?:  string;
  nivel_riesgo:        string;
  aviso_ia?:           string;
  veh_placa:           string;
  tra_nombre_completo: string;
  tra_telefono?:       string;
  tra_correo?:         string;
  horas_espera?:       number; // default 24
}

export interface ResultadoNotificacion {
  ok:              boolean;
  whatsapp?:       { ok: boolean; detalle: string };
  email?:          { ok: boolean; detalle: string };
  programada_para?: string;
  horas?:          number;
  mensaje?:        string;
  error?:          string;
}

/**
 * Llama al endpoint POST /notificar para enviar una alerta al dueño del vehículo.
 * - tipo='despachado_con_alerta' → WhatsApp + Gmail inmediato
 * - tipo='pendiente'             → WhatsApp + Gmail a las 24h
 */
export async function enviarNotificacion(
  datos: DatosNotificacion
): Promise<ResultadoNotificacion> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}/notificar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(datos),
      signal:  controller.signal,
    });
    const res = await response.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
    return res as ResultadoNotificacion;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: 'La API tardó demasiado. ¿Está corriendo uvicorn en el puerto 8000?' };
    }
    return { ok: false, error: String(e) };
  } finally {
    clearTimeout(timeout);
  }
}