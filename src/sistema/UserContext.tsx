import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserContextValue {
    user: User | null;
    session: Session | null;
    dbUserId: number | null;
    roles: string[];
    loading: boolean;
    logout: () => Promise<void>;
    // Helpers de rol
    hasRole: (rol: string) => boolean;
    hasAnyRole: (roles: string[]) => boolean;
    isAdmin: boolean;
    isGerencia: boolean;
    isDespachador: boolean;
}

export const UserContext = createContext<UserContextValue>({
    user: null,
    session: null,
    dbUserId: null,
    roles: [],
    loading: true,
    logout: async () => {},
    hasRole: () => false,
    hasAnyRole: () => false,
    isAdmin: false,
    isGerencia: false,
    isDespachador: false,
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
    children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [dbUserId, setDbUserId] = useState<number | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDbUserId = async (email: string) => {
        try {
            const { data, error } = await supabase.from('usuario').select('usr_id').eq('usr_correo', email).single();
            if (data && data.usr_id) {
                setDbUserId(data.usr_id);
            } else {
                setDbUserId(null);
            }
        } catch (error) {
            console.error('Error fetching dbUserId:', error);
            setDbUserId(null);
        }
    };

    // Usar el RPC mis_roles() definido en el script SQL
    const fetchRoles = async () => {
        try {
            const { data, error } = await supabase.rpc('mis_roles');
            if (error) {
                console.error('Error fetching roles via RPC:', error);
                return;
            }
            setRoles((data as string[]) ?? []);
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    useEffect(() => {
        let mounted = true;

        // Safety timeout — never stay stuck loading for more than 4 seconds
        const safetyTimeout = setTimeout(() => {
            if (mounted) setLoading(false);
        }, 4000);

        async function getInitialSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (mounted) {
                    if (!error && session?.user) {
                        setSession(session);
                        setUser(session.user);
                        if (session.user.email) {
                            fetchDbUserId(session.user.email);
                        }
                        // Non-blocking: fetch roles in background
                        fetchRoles();
                    }
                    clearTimeout(safetyTimeout);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error getting session:', error);
                clearTimeout(safetyTimeout);
                if (mounted) setLoading(false);
            }
        }

        getInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (mounted) {
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        if (session.user.email) {
                            fetchDbUserId(session.user.email);
                        }
                        // Non-blocking: fetch roles in background
                        fetchRoles();
                    } else {
                        setRoles([]);
                        setDbUserId(null);
                    }
                    // Always resolve loading on auth state change
                    setLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const logout = async () => {
        await supabase.auth.signOut();
    };

    // Helpers derivados del array de roles
    const hasRole = (rol: string) => roles.includes(rol);
    const hasAnyRole = (r: string[]) => r.some(rol => roles.includes(rol));
    const isAdmin = roles.includes('administrador');
    const isGerencia = roles.includes('gerencia');
    const isDespachador = roles.includes('despachador');

    return (
        <UserContext.Provider value={{
            user, session, dbUserId, roles, loading, logout,
            hasRole, hasAnyRole, isAdmin, isGerencia, isDespachador,
        }}>
            {children}
        </UserContext.Provider>
    );
};
