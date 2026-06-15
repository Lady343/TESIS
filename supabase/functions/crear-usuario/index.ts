import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nombre, correo, password, rol_nombre } = await req.json()

    // Validate inputs
    if (!nombre || !correo || !password || !rol_nombre) {
      throw new Error('Faltan parámetros requeridos: nombre, correo, password o rol_nombre')
    }

    // Initialize Supabase Admin Client using the Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name: nombre }
    })

    if (authError) {
      throw authError
    }

    const authUserId = authData.user.id

    // 2. Insert into custom 'usuario' table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('usuario')
      .insert({
        auth_user_id: authUserId,
        usr_nombre: nombre,
        usr_correo: correo,
        usr_estado: 'activo'
      })
      .select('usr_id')
      .single()

    if (userError) {
      throw userError
    }

    const usrId = userData.usr_id

    // 3. Get Role ID from 'rol' table
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('rol')
      .select('rol_id')
      .eq('rol_nombre', rol_nombre)
      .single()

    if (roleError || !roleData) {
      throw new Error('Rol no encontrado en la base de datos')
    }

    const rolId = roleData.rol_id

    // 4. Assign role in 'usuario_rol'
    const { error: assignError } = await supabaseAdmin
      .from('usuario_rol')
      .insert({
        usr_id: usrId,
        rol_id: rolId
      })

    if (assignError) {
      throw assignError
    }

    // Success response
    return new Response(
      JSON.stringify({ message: 'Usuario creado exitosamente', user: authData.user }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
