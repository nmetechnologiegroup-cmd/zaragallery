import React, { useState, useEffect } from 'react';
import { User, Role, AppSettings } from '../types';
import { Users, UserPlus, Shield, Key, Trash2, Edit2, X, Check, Clock, Lock as LockIcon, Unlock, Settings2, ShieldCheck, ShieldAlert, ShoppingCart, History as HistoryIcon, Upload } from 'lucide-react';
import { uploadImage } from '../utils/fileHelper';

interface TeamManagementProps {
  users: User[];
  setUsers: (u: User[]) => void;
  currentUser: User;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  onDownloadBackup: () => void;
}

export default function TeamManagement({ users, setUsers, currentUser, settings, setSettings, onDownloadBackup }: TeamManagementProps) {
  const [activeTab, setActiveTab] = useState<'TEAM' | 'SETTINGS'>('TEAM');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<Role>('CAISSIER');
  const [isActive, setIsActive] = useState(true);
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');

  // Fine-grained rights / Habilitations variables
  const [canViewWholesale, setCanViewWholesale] = useState(false);
  const [canViewInventory, setCanViewInventory] = useState(false);
  const [canViewStats, setCanViewStats] = useState(false);
  const [canViewCRM, setCanViewCRM] = useState(false);
  const [canViewPromotions, setCanViewPromotions] = useState(false);
  const [canViewUsers, setCanViewUsers] = useState(false);
  const [canViewAudit, setCanViewAudit] = useState(false);

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Apply default rights helper when role changes
  const applyDefaultPermissionsForRole = (selectedRole: Role) => {
    if (selectedRole === 'ADMIN') {
      setCanViewWholesale(true);
      setCanViewInventory(true);
      setCanViewStats(true);
      setCanViewCRM(true);
      setCanViewPromotions(true);
      setCanViewUsers(true);
      setCanViewAudit(true);
    } else if (selectedRole === 'MANAGER') {
      setCanViewWholesale(true);
      setCanViewInventory(true);
      setCanViewStats(true);
      setCanViewCRM(true);
      setCanViewPromotions(false);
      setCanViewUsers(false);
      setCanViewAudit(false);
    } else { // CAISSIER
      setCanViewWholesale(false);
      setCanViewInventory(false);
      setCanViewStats(false);
      setCanViewCRM(false);
      setCanViewPromotions(false);
      setCanViewUsers(false);
      setCanViewAudit(false);
    }
  };

  const handleRoleChange = (selectedRole: Role) => {
    setRole(selectedRole);
    applyDefaultPermissionsForRole(selectedRole);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    
    const userPermissions = {
      canViewWholesale,
      canViewInventory,
      canViewStats,
      canViewCRM,
      canViewPromotions,
      canViewUsers,
      canViewAudit
    };

    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        name, 
        pin, 
        role, 
        isActive, 
        openingTime: openingTime || undefined, 
        closingTime: closingTime || undefined,
        permissions: userPermissions
      } : u));
      setSaveFeedback('Profil utilisateur modifié avec succès');
      setTimeout(() => setSaveFeedback(''), 3000);
    } else {
      const newUser: User = {
        id: `USR-${Date.now()}`,
        name,
        pin,
        role,
        isActive: true,
        openingTime: openingTime || undefined,
        closingTime: closingTime || undefined,
        permissions: userPermissions
      };
      setUsers([...users, newUser]);
      setSaveFeedback('Nouvel accès utilisateur créé');
      setTimeout(() => setSaveFeedback(''), 3000);
    }
    
    handleCloseModal();
  };

  const toggleUserStatus = (id: string) => {
    if (id === currentUser.id) return alert("Vous ne pouvez pas désactiver votre propre compte.");
    setUsers(users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u));
    setSaveFeedback('Statut de connexion mis à jour');
    setTimeout(() => setSaveFeedback(''), 3000);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingUser(null);
    setName('');
    setPin('');
    setRole('CAISSIER');
    setIsActive(true);
    setOpeningTime('');
    setClosingTime('');
    // Reset permissions
    setCanViewWholesale(false);
    setCanViewInventory(false);
    setCanViewStats(false);
    setCanViewCRM(false);
    setCanViewPromotions(false);
    setCanViewUsers(false);
    setCanViewAudit(false);
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) return alert("Vous ne pouvez pas supprimer votre propre compte.");
    if (confirm("Supprimer définitivement cet accès personnel ?")) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setPin(user.pin);
    setRole(user.role);
    setIsActive(user.isActive);
    setOpeningTime(user.openingTime || '');
    setClosingTime(user.closingTime || '');
    
    // Load existing permissions or load defaults
    const perms = user.permissions;
    if (perms) {
      setCanViewWholesale(perms.canViewWholesale ?? false);
      setCanViewInventory(perms.canViewInventory ?? false);
      setCanViewStats(perms.canViewStats ?? false);
      setCanViewCRM(perms.canViewCRM ?? false);
      setCanViewPromotions(perms.canViewPromotions ?? false);
      setCanViewUsers(perms.canViewUsers ?? false);
      setCanViewAudit(perms.canViewAudit ?? false);
    } else {
      // Defer to defaults for legacy database users
      if (user.role === 'ADMIN') {
        setCanViewWholesale(true);
        setCanViewInventory(true);
        setCanViewStats(true);
        setCanViewCRM(true);
        setCanViewPromotions(true);
        setCanViewUsers(true);
        setCanViewAudit(true);
      } else if (user.role === 'MANAGER') {
        setCanViewWholesale(true);
        setCanViewInventory(true);
        setCanViewStats(true);
        setCanViewCRM(true);
        setCanViewPromotions(false);
        setCanViewUsers(false);
        setCanViewAudit(false);
      } else {
        setCanViewWholesale(false);
        setCanViewInventory(false);
        setCanViewStats(false);
        setCanViewCRM(false);
        setCanViewPromotions(false);
        setCanViewUsers(false);
        setCanViewAudit(false);
      }
    }
    setShowAddModal(true);
  };

  // --- SETTINGS LOGIC ---
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveFeedback, setSaveFeedback] = useState('');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    const newSettings = { ...localSettings, ...updates };
    setLocalSettings(newSettings);
    setSettings(newSettings);
    // Removed isDirty toggle since it auto-saves now
    setSaveFeedback('Paramètres mis à jour');
    setTimeout(() => setSaveFeedback(''), 3000);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const url = await uploadImage(file);
      updateSettings({ logoUrl: url });
    } catch (err) {
      console.error('Error uploading logo:', err);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // --- SECURE RESET LOGIC ---
  const [resetStep, setResetStep] = useState(0); // 0: Idle, 1: Confirm Intent, 2: PIN, 3: Final Confirm
  const [resetPin, setResetPin] = useState('');
  const [resetError, setResetError] = useState('');

  const handleReset = () => {
    if (resetPin !== currentUser.pin) {
      setResetError('Code PIN Admin incorrect');
      return;
    }
    setResetStep(3);
  };

  const executeFullReset = () => {
    localStorage.clear();
    // Also try to clear server-side if local server is implemented and user uses it
    // For now we assume typical AI Studio user intent: full wipe
    window.location.reload();
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white flex-1 animate-in fade-in duration-500">
       <div className="max-w-6xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-neutral-100 pb-8 gap-6">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <ShieldCheck className="w-8 h-8 text-black" />
                <h2 className="text-4xl font-black text-black tracking-tighter uppercase leading-none">Administration</h2>
              </div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.3em]">Gestion des accès, de la sécurité et des fenêtres de vente</p>
            </div>
            <div className="flex border-2 border-black p-1">
                <button 
                  onClick={() => setActiveTab('TEAM')}
                  className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'TEAM' ? 'bg-black text-white' : 'bg-transparent text-black'}`}
                >
                  Personnel
                </button>
                <button 
                  onClick={() => setActiveTab('SETTINGS')}
                  className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SETTINGS' ? 'bg-black text-white' : 'bg-transparent text-black'}`}
                >
                  Paramètres Système
                </button>
             </div>
          </div>

          {activeTab === 'TEAM' ? (
            <>
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-neutral-400">Registre des employés</h3>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center shadow-lg"
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Nouvel Employé
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {users.map(user => (
                   <div key={user.id} className={`group border transition-all rounded-sm p-6 flex justify-between items-center ${user.isActive ? 'border-neutral-100 bg-neutral-50/30 hover:border-black' : 'border-red-100 bg-red-50/10 grayscale opacity-60'}`}>
                      <div className="flex items-center gap-6">
                         <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl relative ${
                           user.role === 'ADMIN' ? 'bg-black' : user.role === 'MANAGER' ? 'bg-zinc-700' : 'bg-neutral-400'
                         }`}>
                            {user.name.charAt(0).toUpperCase()}
                            {!user.isActive && <div className="absolute -bottom-1 -right-1 bg-red-600 p-1 rounded-full"><LockIcon className="w-2.5 h-2.5" /></div>}
                         </div>
                         <div>
                            <p className="font-black text-lg tracking-tight text-black flex items-center uppercase">
                              {user.name}
                              {user.id === currentUser.id && <span className="ml-2 text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 tracking-widest uppercase">Moi</span>}
                            </p>
                            {user.openingTime || user.closingTime ? (
                              <div className="flex flex-wrap items-center gap-1.5 mb-1 bg-red-100/10 px-2.5 py-1 border border-red-200/50">
                                <Clock className="w-3 h-3 text-red-500 animate-pulse" />
                                <span className="text-[9px] font-black text-red-600 tracking-wider">MARGE SESSION : {user.openingTime || '00:00'} - {user.closingTime || '24:00'}</span>
                              </div>
                            ) : null}
                            <div className="flex items-center gap-3 mt-1">
                               <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center">
                                 <Shield className="w-3 h-3 mr-1" /> {user.role}
                               </span>
                               <span className={`text-[9px] font-black uppercase tracking-widest flex items-center ${user.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                                 {user.isActive ? 'Actif' : 'Suspendu'}
                               </span>
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button 
                           onClick={() => toggleUserStatus(user.id)}
                           title={user.isActive ? 'Désactiver le compte' : 'Activer le compte'}
                           className={`p-3 transition-colors ${user.isActive ? 'text-neutral-400 hover:text-red-500' : 'text-emerald-500 hover:text-emerald-700'}`}
                         >
                            {user.isActive ? <LockIcon className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                         </button>
                         <button onClick={() => openEdit(user)} className="p-3 text-neutral-400 hover:text-black transition-colors">
                            <Edit2 className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleDeleteUser(user.id)} disabled={user.id === currentUser.id} className="p-3 text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-0">
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in slide-in-from-bottom-4 duration-300">
               {saveFeedback && (
                 <div className="col-span-1 md:col-span-2 bg-emerald-50 text-emerald-700 p-4 font-black uppercase tracking-widest text-[10px] text-center border-l-4 border-emerald-500 animate-in fade-in duration-300">
                   {saveFeedback}
                 </div>
               )}
               {/* Sales Control */}
               <div className="space-y-10">
                  <div className="bg-neutral-50 p-10 border border-neutral-100 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ShoppingCart className="w-32 h-32" />
                     </div>
                     <h4 className="text-lg font-black uppercase tracking-tighter mb-2">Contrôle des Ventes</h4>
                     <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-8">Verrouillage manuel et automatique des terminaux de paiement</p>
                     
                     <div className="space-y-8">
                        <div className="flex items-center justify-between p-6 bg-white border border-neutral-100 shadow-sm">
                           <div>
                              <p className="text-xs font-black uppercase tracking-widest">Fermeture de Caisse Obligatoire</p>
                              <p className="text-[9px] text-neutral-400 uppercase font-bold mt-1">Exiger l'ouverture et la fermeture (rapport Z) des sessions de vente</p>
                           </div>
                           <button 
                             onClick={() => updateSettings({ isCashSessionRequired: !localSettings.isCashSessionRequired })}
                             className={`w-14 h-7 rounded-full transition-all relative ${localSettings.isCashSessionRequired ? 'bg-black' : 'bg-neutral-200'}`}
                           >
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${localSettings.isCashSessionRequired ? 'right-1' : 'left-1'}`}></div>
                           </button>
                        </div>
                        <div className="flex items-center justify-between p-6 bg-white border border-neutral-100 shadow-sm">
                           <div>
                              <p className="text-xs font-black uppercase tracking-widest">Verrouillage Manuel</p>
                              <p className="text-[9px] text-neutral-400 uppercase font-bold mt-1">Bloque instantanément tous les paiements (Hors Admin)</p>
                           </div>
                           <button 
                             onClick={() => updateSettings({ manualLock: !localSettings.manualLock, isPaymentLocked: !localSettings.manualLock })}
                             className={`px-6 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${localSettings.manualLock ? 'bg-red-600 text-white' : 'bg-black text-white hover:bg-neutral-800'}`}
                           >
                              {localSettings.manualLock ? 'Système Verrouillé' : 'Verrouiller Maintenant'}
                           </button>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-white border border-neutral-100 shadow-sm">
                           <div>
                              <p className="text-xs font-black uppercase tracking-widest">Planification Automatique</p>
                              <p className="text-[9px] text-neutral-400 uppercase font-bold mt-1">Activer/Désactiver les ventes selon les horaires</p>
                           </div>
                           <button 
                             onClick={() => updateSettings({ autoLockEnabled: !localSettings.autoLockEnabled })}
                             className={`w-14 h-7 rounded-full transition-all relative ${localSettings.autoLockEnabled ? 'bg-black' : 'bg-neutral-200'}`}
                           >
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${localSettings.autoLockEnabled ? 'right-1' : 'left-1'}`}></div>
                           </button>
                        </div>

                        {localSettings.autoLockEnabled && (
                          <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500">
                             <div>
                                <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5">Heure d'ouverture (Activation)</label>
                                <div className="relative">
                                   <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                                   <input 
                                     type="time" 
                                     value={localSettings.openingTime}
                                     onChange={e => updateSettings({ openingTime: e.target.value })}
                                     className="w-full pl-8 pr-4 py-3 bg-white border border-neutral-200 text-xs font-black outline-none focus:border-black"
                                   />
                                </div>
                             </div>
                             <div>
                                <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5">Heure de Fermeture (Désactivation)</label>
                                <div className="relative">
                                   <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                                   <input 
                                     type="time" 
                                     value={localSettings.closingTime}
                                     onChange={e => updateSettings({ closingTime: e.target.value })}
                                     className="w-full pl-8 pr-4 py-3 bg-white border border-neutral-200 text-xs font-black outline-none focus:border-black"
                                   />
                                </div>
                             </div>
                          </div>
                        )}
                     </div>
                  </div>

                  <div className={`p-8 border-2 flex items-center gap-6 ${localSettings.isPaymentLocked ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                     <div className={`p-4 rounded-full ${localSettings.isPaymentLocked ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {localSettings.isPaymentLocked ? <LockIcon className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
                     </div>
                     <div>
                        <h5 className={`text-xl font-black uppercase tracking-tighter ${localSettings.isPaymentLocked ? 'text-red-700' : 'text-emerald-700'}`}>
                           {localSettings.isPaymentLocked ? 'Système de Paiement Clos' : 'Système de Paiement Ouvert'}
                        </h5>
                        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                           {localSettings.isPaymentLocked 
                             ? 'Le passage en caisse est actuellement impossible pour les vendeurs.' 
                             : 'Les vendeurs peuvent effectuer des transactions normales.'}
                        </p>
                     </div>
                  </div>
               </div>

               {/* General Shop Info & Maintenance */}
               <div className="space-y-8">
                  <div className="bg-neutral-900 p-10 text-white">
                     <Settings2 className="w-10 h-10 mb-6 text-neutral-400" />
                     <h4 className="text-xl font-black uppercase tracking-tighter mb-6">Configuration Boutique</h4>
                     
                     <div className="space-y-6">
                        {/* Logo Upload Section */}
                        <div>
                           <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Logo de la Boutique</p>
                           <div className="flex items-center gap-4">
                              {localSettings.logoUrl ? (
                                 <div className="w-16 h-16 bg-white flex items-center justify-center p-1 border border-neutral-700 relative group">
                                    <img src={localSettings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                                    <button 
                                       type="button" 
                                       onClick={() => updateSettings({ logoUrl: '' })} 
                                       className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full text-[8px] font-bold hover:bg-red-700 transition-colors"
                                    >
                                       ✕
                                    </button>
                                 </div>
                              ) : (
                                 <div className="w-16 h-16 bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500 text-[10px] font-bold uppercase tracking-wider">
                                    Aucun
                                 </div>
                              )}
                              <label className="cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                                 <Upload className="w-3.5 h-3.5" />
                                 {isUploadingLogo ? 'Téléchargement...' : 'Choisir image'}
                                 <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                              </label>
                           </div>
                        </div>

                        <div>
                           <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">Nom de l'Etablissement</p>
                           <input 
                              type="text" 
                              value={localSettings.storeName || ''} 
                              onChange={e => updateSettings({ storeName: e.target.value })} 
                              placeholder="ZARA GALLERY"
                              className="w-full bg-neutral-800 border border-neutral-700 p-3 text-xs font-black uppercase tracking-widest outline-none focus:border-white text-white"
                           />
                        </div>

                        <div>
                           <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">Adresse de la Boutique</p>
                           <input 
                              type="text" 
                              value={localSettings.storeAddress || ''} 
                              onChange={e => updateSettings({ storeAddress: e.target.value })} 
                              placeholder="Ouagadougou, Burkina Faso"
                              className="w-full bg-neutral-800 border border-neutral-700 p-3 text-xs font-black uppercase tracking-widest outline-none focus:border-white text-white"
                           />
                        </div>

                        <div>
                           <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">Téléphone de la Boutique</p>
                           <input 
                              type="text" 
                              value={localSettings.storePhone || ''} 
                              onChange={e => updateSettings({ storePhone: e.target.value })} 
                              placeholder="+223 20 22 44 66"
                              className="w-full bg-neutral-800 border border-neutral-700 p-3 text-xs font-black uppercase tracking-widest outline-none focus:border-white text-white"
                           />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                           <div>
                              <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">Devise du Système</p>
                              <p className="text-sm font-black uppercase tracking-tight text-white/90">F CFA (XOF)</p>
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">Taux TVA Standard</p>
                              <p className="text-sm font-black uppercase tracking-tight text-white/90">18 %</p>
                           </div>
                        </div>
                     </div>
                     
                     <div className="mt-10 pt-6 border-t border-neutral-800">
                        <button 
                          onClick={onDownloadBackup}
                          className="w-full flex items-center justify-center gap-3 py-4 border border-neutral-700 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                        >
                           <HistoryIcon className="w-4 h-4" /> Exporter Sauvegarde (.json)
                        </button>
                     </div>
                  </div>

                  <div className="p-8 border border-red-100 bg-red-50/20 text-center">
                    <ShieldAlert className="w-8 h-8 text-red-600 mx-auto mb-4" />
                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em] mb-4">Urgence Administrative</h4>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-6">Réinitialisation totale des Ventes, Stocks et Clients</p>
                    <button 
                      onClick={() => setResetStep(1)}
                      className="w-full py-4 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl"
                    >
                      DÉMARRER LA RÉINITIALISATION
                    </button>
                  </div>
               </div>
            </div>
          )}

       {/* Secure Reset Modals */}
       {resetStep > 0 && (
         <div className="fixed inset-0 bg-neutral-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white max-w-sm w-full p-10 border-4 border-red-600 animate-in zoom-in duration-150">
               {resetStep === 1 && (
                 <div className="text-center">
                    <Shield className="w-12 h-12 text-red-600 mx-auto mb-6" />
                    <h3 className="text-xl font-black uppercase tracking-tighter mb-4 text-red-600">Action Irréversible</h3>
                    <p className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest leading-relaxed mb-8">
                       Vous êtes sur le point de supprimer TOUTES les données de ventes et les clients. Voulez-vous continuer ?
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => setResetStep(0)} className="py-3 border border-neutral-200 text-[10px] font-black uppercase tracking-widest">Non, Annuler</button>
                       <button onClick={() => setResetStep(2)} className="py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">Oui, Continuer</button>
                    </div>
                 </div>
               )}

               {resetStep === 2 && (
                 <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter mb-6 text-center">Vérouillage Securisé</h3>
                    <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2 block">Saisissez votre code PIN Admin</label>
                    <input 
                      type="password"
                      maxLength={4}
                      value={resetPin}
                      onChange={e => { setResetPin(e.target.value); setResetError(''); }}
                      className="w-full text-4xl text-center font-black py-4 border-b-4 border-black outline-none tracking-[0.5em] mb-4"
                      placeholder="****"
                    />
                    {resetError && <p className="text-red-600 text-[9px] font-bold uppercase mb-6 text-center">{resetError}</p>}
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => setResetStep(0)} className="py-3 border border-neutral-200 text-[10px] font-black uppercase tracking-widest">Annuler</button>
                       <button onClick={handleReset} className="py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest">Valider PIN</button>
                    </div>
                 </div>
               )}

               {resetStep === 3 && (
                 <div className="text-center">
                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 text-red-600">DERNIER AVERTISSEMENT</h3>
                    <p className="text-[11px] font-bold text-neutral-700 uppercase tracking-widest leading-relaxed mb-10">
                       Êtes-vous ABSOLUMENT certain ? Cette opération efface tout.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => setResetStep(0)} className="py-3 border border-neutral-200 text-[10px] font-black uppercase tracking-widest">ANNULER TOUT</button>
                       <button onClick={executeFullReset} className="py-4 bg-red-600 text-white text-[11px] font-black uppercase tracking-widest shadow-2xl">OUI, TOUT EFFACER</button>
                    </div>
                 </div>
               )}
            </div>
         </div>
       )}

       {/* Add/Edit Modal */}
       {showAddModal && (
         <div className="fixed inset-0 bg-neutral-900/60 z-[70] flex flex-col items-center justify-start p-4 overflow-y-auto backdrop-blur-sm pt-8 md:pt-20">
            <div className="bg-white max-w-md w-full border-2 border-black p-6 md:p-10 animate-in zoom-in duration-150 mb-10">
               <div className="flex justify-between items-center mb-10 border-b border-neutral-100 pb-4">
                  <h3 className="text-xl font-black uppercase tracking-tighter">
                     {editingUser ? 'Modifier Profil' : 'Nouvel Accès'}
                  </h3>
                  <button onClick={handleCloseModal} className="text-neutral-400 hover:text-black">
                     <X className="w-6 h-6" />
                  </button>
               </div>

               <form onSubmit={handleSaveUser} className="space-y-8">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Nom de l'employé</label>
                    <input 
                      required
                      type="text" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full text-lg font-black py-3 border-b-2 border-neutral-200 outline-none focus:border-black transition-all"
                      placeholder="Ex: Alimata Sawadogo"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Code PIN (4 chiffres)</label>
                      <input 
                        required
                        type="password"
                        maxLength={4}
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g,''))}
                        className="w-full text-lg font-black py-3 border-b-2 border-neutral-200 outline-none focus:border-black transition-all tracking-[1em]"
                        placeholder="****"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Niveau d'accès</label>
                      <select 
                        value={role}
                        onChange={e => handleRoleChange(e.target.value as Role)}
                        className="w-full bg-neutral-50 text-xs font-bold uppercase tracking-widest p-4 outline-none border-b-2 border-neutral-200 focus:border-black"
                      >
                         <option value="CAISSIER">Caissier</option>
                         <option value="MANAGER">Manager</option>
                         <option value="ADMIN">Administrateur</option>
                      </select>
                    </div>
                  </div>

                  {/* DROITS ET HABILITATIONS PERSONNALISÉES */}
                  <div className="border-2 border-black p-5 bg-white space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black block border-b border-neutral-200 pb-2 mb-2">
                      Permissions & Droits d'Accès
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 max-h-48 overflow-y-auto pr-1">
                      <label className="flex items-center gap-3 py-1 cursor-pointer hover:bg-neutral-50 rounded px-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={canViewWholesale}
                          onChange={e => setCanViewWholesale(e.target.checked)}
                          className="w-4 h-4 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">Espace Grossistes (B2B)</span>
                      </label>

                      <label className="flex items-center gap-3 py-1 cursor-pointer hover:bg-neutral-50 rounded px-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={canViewInventory}
                          onChange={e => setCanViewInventory(e.target.checked)}
                          className="w-4 h-4 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">Articles & Stocks (Inventaire)</span>
                      </label>

                      <label className="flex items-center gap-3 py-1 cursor-pointer hover:bg-neutral-50 rounded px-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={canViewStats}
                          onChange={e => setCanViewStats(e.target.checked)}
                          className="w-4 h-4 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">Statistiques & Rapports (Direction)</span>
                      </label>

                      <label className="flex items-center gap-3 py-1 cursor-pointer hover:bg-neutral-50 rounded px-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={canViewCRM}
                          onChange={e => setCanViewCRM(e.target.checked)}
                          className="w-4 h-4 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">Fidélité Clients (CRM)</span>
                      </label>

                      <label className="flex items-center gap-3 py-1 cursor-pointer hover:bg-neutral-50 rounded px-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={canViewPromotions}
                          onChange={e => setCanViewPromotions(e.target.checked)}
                          className="w-4 h-4 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">Promotions & Publicité</span>
                      </label>

                      <label className="flex items-center gap-3 py-1 cursor-pointer hover:bg-neutral-50 rounded px-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={canViewUsers}
                          onChange={e => setCanViewUsers(e.target.checked)}
                          className="w-4 h-4 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">Gestion Équipe (Personnel / Droits)</span>
                      </label>

                      <label className="flex items-center gap-3 py-1 cursor-pointer hover:bg-neutral-50 rounded px-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={canViewAudit}
                          onChange={e => setCanViewAudit(e.target.checked)}
                          className="w-4 h-4 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800">Journal d'Audit de Sécurité</span>
                      </label>
                    </div>
                  </div>

                  {/* RESTRICTION HORAIRE INDIVIDUELLE */}
                  <div className="border border-neutral-200 p-5 bg-neutral-50 rounded-sm space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 block mb-1">
                      Horaires Autorisés (Caisse)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Heure de début</label>
                        <input 
                          type="time" 
                          value={openingTime}
                          onChange={e => setOpeningTime(e.target.value)}
                          className="w-full bg-white text-xs font-bold p-2.5 border border-neutral-200 outline-none focus:border-black transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Heure de fin</label>
                        <input 
                          type="time" 
                          value={closingTime}
                          onChange={e => setClosingTime(e.target.value)}
                          className="w-full bg-white text-xs font-bold p-2.5 border border-neutral-200 outline-none focus:border-black transition-all"
                        />
                      </div>
                    </div>
                    <p className="text-[8px] text-neutral-400 uppercase font-black tracking-tight leading-relaxed">
                      * Laissez vide si cet employé est autorisé à effectuer des ventes à n'importe quelle heure de la journée.
                    </p>
                  </div>

                  <div className="pt-6">
                     <button 
                       type="submit" 
                       className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-800 shadow-xl flex items-center justify-center gap-2"
                     >
                       <Check className="w-4 h-4" /> Enregistrer le profil
                     </button>
                  </div>
               </form>
            </div>
         </div>
       )}
      </div>
    </div>
  );
}
