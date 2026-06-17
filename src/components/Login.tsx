import React, { useState } from 'react';
import { User, AppSettings } from '../types';
import { Lock as LockIcon, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (u: User) => void;
  users: User[];
  settings?: AppSettings;
}

export default function Login({ onLogin, users, settings }: LoginProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    const user = users.find(u => u.pin === pin);
    if (user) {
      if (user.isActive === false) {
        setError("Ce compte a été suspendu.");
        setPin('');
        return;
      }
      onLogin(user);
    } else {
      setError("Code PIN incorrect ou révoqué.");
      setPin('');
    }
  };

  const addNumber = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      if(newPin.length === 4) {
        setTimeout(() => {
          const user = users.find(u => u.pin === newPin);
          if (user) {
            if (user.isActive === false) {
               setError("Compte Suspendu.");
               setPin('');
               return;
            }
            onLogin(user);
          } else {
            setError("Code PIN incorrect.");
            setPin('');
          }
        }, 150);
      }
    }
  };

  const removeNumber = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-start p-4 md:p-8 font-sans tracking-tight focus:outline-none overflow-y-auto py-12 md:py-24">
      
      {/* Sleek, ultra-compact luxury card */}
      <div className="w-full max-w-sm bg-white border border-neutral-200/80 overflow-hidden flex-shrink-0 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)]">
        
        <div className="bg-white text-black pt-8 md:pt-12 pb-6 md:pb-10 px-6 md:px-8 text-center border-b border-neutral-100 flex flex-col items-center">
           {settings?.logoUrl ? (
             <img src={settings.logoUrl} alt="Logo" className="max-h-24 md:max-h-32 w-auto object-contain mb-4" referrerPolicy="no-referrer" />
           ) : null}
           <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter break-all text-neutral-900 leading-none">
             {settings?.storeName || 'ZARA'}
           </h1>
           <p className="font-semibold text-[8px] md:text-[9px] tracking-[0.25em] text-neutral-400 uppercase mt-2 mb-4 md:mb-6 text-center max-w-[200px] leading-normal line-clamp-2">
             {settings?.storeAddress || 'ZARA GALLERY • Ouagadougou'}
           </p>
           
           <h2 className="text-neutral-500 font-black tracking-[0.15em] text-[8px] uppercase flex justify-center items-center gap-2 opacity-90">
             AUTHENTIFICATION SÉCURISÉE
           </h2>
        </div>

        <div className="px-6 md:px-8 py-6 md:py-8 bg-neutral-50/60 border-b border-neutral-100">
          <div className="flex justify-center gap-2 md:gap-3 relative">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-10 h-12 md:w-12 md:h-14 rounded-none flex items-center justify-center text-xl md:text-2xl font-bold transition-all duration-300 ${pin[i] ? 'bg-black text-white scale-102' : 'bg-white border border-neutral-200 text-transparent'}`}>
                {pin[i] ? '•' : ''}
              </div>
            ))}
          </div>
          <div className="h-4 mt-4 flex items-center justify-center">
              {error && (
                <p className="text-red-600 text-[9px] font-bold uppercase tracking-widest flex items-center animate-in zoom-in duration-200">
                  <AlertCircle className="w-2.5 h-2.5 mr-1" /> {error}
                </p>
              )}
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button 
                key={num} 
                onClick={() => addNumber(num.toString())}
                className="bg-white hover:bg-neutral-900 hover:text-white text-black font-semibold text-lg h-12 md:h-14 rounded-none transition-all border border-neutral-200 active:scale-95 shadow-sm flex items-center justify-center cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button 
              onClick={removeNumber}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold text-[8px] md:text-[9px] h-12 md:h-14 rounded-none transition-all uppercase tracking-widest active:scale-95 flex items-center justify-center cursor-pointer"
            >
              Retour
            </button>
            <button 
              onClick={() => addNumber('0')}
              className="bg-white hover:bg-neutral-900 hover:text-white text-black font-semibold text-lg h-12 md:h-14 rounded-none transition-all border border-neutral-200 active:scale-95 shadow-sm flex items-center justify-center cursor-pointer"
            >
              0
            </button>
            <button 
              onClick={(e) => handleSubmit()}
              disabled={pin.length !== 4}
              className="bg-black hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200 text-white font-bold text-[9px] md:text-[10px] h-12 md:h-14 rounded-none transition-all uppercase tracking-widest active:scale-95 border border-black cursor-pointer"
            >
              Entrer
            </button>
          </div>
        </div>

        <div className="bg-neutral-50 py-4 md:py-5 text-center border-t border-neutral-100 flex flex-col gap-1 md:gap-2 justify-center text-[8px] md:text-[9px] font-mono text-neutral-400">
           <div className="flex justify-center gap-3 md:gap-4">
             <span>Admin:<strong className="text-neutral-900 ml-1">1234</strong></span>
             <span>Manager:<strong className="text-neutral-900 ml-1">5678</strong></span>
             <span>Caisse:<strong className="text-neutral-900 ml-1">0000</strong></span>
           </div>
           <span className="text-[7px] md:text-[8px] tracking-[0.2em] font-sans text-neutral-300 font-bold">TERMINAL POS V4.2</span>
        </div>

      </div>
    </div>
  );
}
