import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = '2xl' }: ModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setMounted(false), 300);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !mounted) return null;

    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        '6xl': 'max-w-6xl',
        '7xl': 'max-w-7xl',
    };

    const modalContent = (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop sin fondo borroso (blur) */}
            <div
                className="absolute inset-0 bg-gray-900/60 transition-opacity"
                onClick={onClose}
            />

            {/* Content sin bordes problemáticos */}
            <div className={`
                relative bg-white w-full ${maxWidthClasses[maxWidth]} rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 transform
                ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}
            `}>
                {/* Header */}
                <div className="px-6 py-5 flex items-center justify-between bg-white relative">
                    <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all active:scale-90"
                    >
                        <X size={20} />
                    </button>
                    {/* 🌊 Modal Header Wave Divider (Restaurada) */}
                    <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] h-1 opacity-[0.15]">
                        <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path d="M0,0 C150,0 200,100 400,100 C600,100 800,0 1200,0 L1200,120 L0,120 Z" fill="#10b981" />
                        </svg>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-hide">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
