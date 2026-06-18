import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Package, BarChart3, Users, Store, LogOut, Wifi, WifiOff, Boxes } from 'lucide-react';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import CashManagement from './components/CashManagement';
import TeamManagement from './components/TeamManagement';
import AuditLog from './components/AuditLog';
import PromotionManager from './components/PromotionManager';
import CRM from './components/CRM';
import Chat from './components/Chat';
import SalesHistory from './components/SalesHistory';
import WholesaleManager from './components/WholesaleManager';
import { INITIAL_PRODUCTS, USERS, INITIAL_PROMOTIONS, INITIAL_CUSTOMERS, INITIAL_SETTINGS } from './data';
import { Product, Order, User, CashMovement, AuditLogEntry, Customer, Promotion, ProductMovement, ChatMessage, PendingTicket, AppSettings, CashRegisterSession, UserPermissions } from './types';
import { Wholesaler, WholesaleOrder } from './types_wholesale';
import { ShieldCheck, Image as ImageIcon, Users2, MessageSquare, Lock as LockIcon, ReceiptText } from 'lucide-react';

const INITIAL_WHOLESALERS: Wholesaler[] = [
  { id: 'GROS-1', name: 'Omar Sy', companyName: 'Dakar Fripes Gros', phone: '+221 77 555 11 22', email: 'omar@grosfripes.sn', address: 'Grand Yoff, Dakar', balance: 0, creditLimit: 5000000, createdAt: new Date().toISOString() },
  { id: 'GROS-2', name: 'Alou Diallo', companyName: 'Diallo Frères Import', phone: '+221 70 444 33 22', email: 'contact@diallobros.com', address: 'Marché HLM, Dakar', balance: 1450000, creditLimit: 8000000, createdAt: new Date().toISOString() },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<'IDLE' | 'SYNCING' | 'SAVED'>('IDLE');
  const [serverOnline, setServerOnline] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // App State
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>(USERS);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [promotions, setPromotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [stockMovements, setStockMovements] = useState<ProductMovement[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingTickets, setPendingTickets] = useState<PendingTicket[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);

  // Cash Register Sessions State
  const [currentSession, setCurrentSession] = useState<CashRegisterSession | null>(null);
  const [sessionsHistory, setSessionsHistory] = useState<CashRegisterSession[]>([]);

  // B2B Wholesale state
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>(INITIAL_WHOLESALERS);
  const [wholesaleOrders, setWholesaleOrders] = useState<WholesaleOrder[]>([]);

  // Timer for debounced save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // --- LOCAL SERVER SYNC LOGIC ---

  // Initial load from server
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/data?t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data.products) setProducts(data.products);
          if (data.orders) setOrders(data.orders);
          
          let fetchedUsers = data.users ? data.users.map((u: any) => ({ ...u, isActive: u.isActive !== false })) : USERS;
          setUsers(fetchedUsers);
          
          const savedUserId = sessionStorage.getItem('zg_logged_in_user');
          if (savedUserId) {
            const user = fetchedUsers.find((u: any) => u.id === savedUserId);
            if (user) setCurrentUser(user);
          }

          if (data.cashMovements) setCashMovements(data.cashMovements);
          if (data.auditLogs) setAuditLogs(data.auditLogs);
          if (data.customers) setCustomers(data.customers);
          if (data.promotions) setPromotions(data.promotions);
          if (data.stockMovements) setStockMovements(data.stockMovements);
          
          // Initial messages load
          try {
            const mRes = await fetch('/api/messages');
            if (mRes.ok) {
              const mData = await mRes.json();
              setMessages(mData);
            }
          } catch (e) {
            console.error('Error loading initial messages:', e);
          }

          if (data.pendingTickets) setPendingTickets(data.pendingTickets);
          if (data.settings) setSettings({ ...INITIAL_SETTINGS, ...data.settings });
          if (data.wholesalers) setWholesalers(data.wholesalers);
          if (data.wholesaleOrders) setWholesaleOrders(data.wholesaleOrders);
          if (data.currentSession !== undefined) setCurrentSession(data.currentSession);
          if (data.sessionsHistory) setSessionsHistory(data.sessionsHistory);
          setServerOnline(true);
        } else {
          loadFromLocal();
        }
      } catch (err) {
        setServerOnline(false);
        loadFromLocal();
      } finally {
        setIsInitialized(true);
      }
    };

    fetchData();
  }, []);

  const loadFromLocal = () => {
    const saved = localStorage.getItem('zg_local_cache');
    if (saved) {
      const data = JSON.parse(saved);
      setProducts(data.products || INITIAL_PRODUCTS);
      setOrders(data.orders || []);
      
      let fetchedUsers = (data.users || USERS).map((u: any) => ({ ...u, isActive: u.isActive !== false }));
      setUsers(fetchedUsers);
      
      const savedUserId = sessionStorage.getItem('zg_logged_in_user');
      if (savedUserId) {
        const user = fetchedUsers.find((u: any) => u.id === savedUserId);
        if (user) setCurrentUser(user);
      }

      setCashMovements(data.cashMovements || []);
      setAuditLogs(data.auditLogs || []);
      setCustomers(data.customers || INITIAL_CUSTOMERS);
      setPromotions(data.promotions || INITIAL_PROMOTIONS);
      setStockMovements(data.stockMovements || []);
      setMessages(data.messages || []);
      setPendingTickets(data.pendingTickets || []);
      setSettings(data.settings ? { ...INITIAL_SETTINGS, ...data.settings } : INITIAL_SETTINGS);
      setWholesalers(data.wholesalers || INITIAL_WHOLESALERS);
      setWholesaleOrders(data.wholesaleOrders || []);
      setCurrentSession(data.currentSession || null);
      setSessionsHistory(data.sessionsHistory || []);
    }
  };

  // Debounced save
  useEffect(() => {
    if (!isInitialized) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      // EXCLUDE messages from the general POS/Settings save block to prevent write race-conditions
      const dataToSave = {
        products, orders, users, cashMovements, auditLogs, 
        customers, promotions, stockMovements,
        pendingTickets, settings, wholesalers, wholesaleOrders,
        currentSession, sessionsHistory,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem('zg_local_cache', JSON.stringify(dataToSave));

      setIsSyncing('SYNCING');
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave)
        });
        setServerOnline(res.ok);
      } catch (err) {
        setServerOnline(false);
      } finally {
        setIsSyncing('SAVED');
        setTimeout(() => setIsSyncing('IDLE'), 2000);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [products, orders, users, cashMovements, auditLogs, customers, promotions, stockMovements, pendingTickets, settings, wholesalers, wholesaleOrders, currentSession, sessionsHistory, isInitialized]);

  // Real-time Chat poller: Polls messages independently every 4 seconds
  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const pollMessages = async () => {
      try {
        const res = await fetch('/api/messages?t=' + Date.now());
        if (res.ok) {
          const fetchedMsgs = await res.json();
          // Deep compare before setting state to prevent infinite react-render triggers
          if (JSON.stringify(fetchedMsgs) !== JSON.stringify(messages)) {
            setMessages(fetchedMsgs);
          }
        }
      } catch (err) {
        console.error('Error polling chat messages:', err);
      }
    };

    pollMessages();
    timerId = setInterval(pollMessages, 4000);

    return () => clearInterval(timerId);
  }, [messages]);

  // Security: Immediate logout for suspended users
  useEffect(() => {
    if (currentUser) {
      const activeState = users.find(u => u.id === currentUser.id);
      if (activeState && activeState.isActive === false) {
        sessionStorage.removeItem('zg_logged_in_user');
        setCurrentUser(null);
        alert("🔒 SESSION VERROUILLÉE : Votre compte d'accès Zara a été suspendu par la Direction.");
      }
    }
  }, [users, currentUser]);

  // Payment Window Auto-Lock logic
  useEffect(() => {
    const checkPaymentWindow = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      let shouldBeLocked = settings.manualLock;

      if (settings.autoLockEnabled) {
        const isWithinWindow = currentTime >= settings.openingTime && currentTime < settings.closingTime;
        if (!isWithinWindow) {
          shouldBeLocked = true;
        }
      }

      if (shouldBeLocked !== settings.isPaymentLocked) {
        setSettings(prev => ({ ...prev, isPaymentLocked: shouldBeLocked }));
        addAuditLog(shouldBeLocked ? 'PAYMENT_LOCKED' : 'PAYMENT_UNLOCKED', 
          shouldBeLocked 
            ? `Les paiements ont été verrouillés ${settings.manualLock ? 'manuellement' : 'automatiquement'} à ${currentTime}.` 
            : `Le système de paiement est maintenant ouvert.`
        );
      }
    };

    checkPaymentWindow();
    const interval = setInterval(checkPaymentWindow, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [settings.openingTime, settings.closingTime, settings.autoLockEnabled, settings.manualLock, settings.isPaymentLocked]);

  const addAuditLog = (action: string, details: string, severity: AuditLogEntry['severity'] = 'INFO') => {
    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: currentUser?.name || 'System',
      action,
      details,
      severity
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const trackStockMovement = (productId: string, variantId: string, type: ProductMovement['type'], quantity: number, reason: string) => {
    const newMovement: ProductMovement = {
      id: `MOV-${Date.now()}`,
      productId,
      variantId,
      type,
      quantity,
      reason,
      date: new Date().toISOString(),
      user: currentUser?.name || 'System'
    };
    setStockMovements(prev => [newMovement, ...prev]);
  };

  const handleCompleteOrder = (order: Order, updatedProducts: Product[]) => {
    setOrders(prev => [order, ...prev]);
    setProducts(updatedProducts);
    
    order.items.forEach(item => {
      trackStockMovement(item.product.id, item.variant.id, 'SALE', -item.quantity, `Vente Order #${order.id}`);
    });

    addAuditLog('SALE_COMPLETED', `Vente #${order.id} complétée par ${order.cashier}. Total: ${order.total} F CFA.`);
  };

  const handleLogout = () => {
    addAuditLog('USER_LOGOUT', `Déconnexion de ${currentUser?.name}`);
    sessionStorage.removeItem('zg_logged_in_user');
    setCurrentUser(null);
    setActiveTab('pos');
  };

  if (!isInitialized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-white font-mono text-sm tracking-widest relative overflow-hidden">
        <div className="absolute inset-0 bg-neutral-900 opacity-50" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }}></div>
        <div className="z-10 flex flex-col items-center animate-pulse">
           <div className="text-3xl font-black tracking-[0.4em] mb-4">ZARA</div>
           <div className="text-[10px] text-neutral-400">CHARGEMENT DU SYSTÈME ZARA POS...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={(user) => { 
      setCurrentUser(user);
      sessionStorage.setItem('zg_logged_in_user', user.id);
      addAuditLog('USER_LOGIN', `Connexion de ${user.name} (${user.role})`);
    }} users={users} settings={settings} />;
  }

  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER' || isAdmin;

  const hasAppAccess = (permKey: keyof UserPermissions, isAllowedByRoleFallback: boolean) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (currentUser.permissions && currentUser.permissions[permKey] !== undefined) {
      return currentUser.permissions[permKey];
    }
    return isAllowedByRoleFallback;
  };

  // Function wrapper to satisfy React's requirement for updating state from props if needed
  const setProductsFromInventory = (newProducts: React.SetStateAction<Product[]>) => {
    if (typeof newProducts === 'function') {
      setProducts(prev => newProducts(prev));
    } else {
      setProducts(newProducts);
    }
  };

  const setUsersFromTeam = (newUsers: User[]) => setUsers(newUsers);
  const setCashMovementsFromCash = (newMovements: CashMovement[] | ((prev: CashMovement[]) => CashMovement[])) => setCashMovements(newMovements);
  const setCustomersFromCRM = (newCustomers: Customer[]) => setCustomers(newCustomers);
  const setPromotionsFromManager = (newPromotions: Promotion[]) => setPromotions(newPromotions);
  const setSettingsFromTeam = (newSettings: AppSettings) => setSettings(newSettings);

  const downloadDatabase = () => {
    const dataToSave = {
      products, orders, users, cashMovements, auditLogs, 
      customers, promotions, stockMovements, messages,
      pendingTickets, settings,
      lastUpdated: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zara_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addAuditLog('DATABASE_BACKUP', `Une copie de sauvegarde de la base de données a été téléchargée par ${currentUser?.name}`);
  };
  const setMessagesFromChat = (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    let resolved: ChatMessage[] = [];
    if (typeof newMessages === 'function') {
      setMessages(prev => {
        resolved = newMessages(prev);
        const lastMsg = resolved[resolved.length - 1];
        if (lastMsg && (!prev.length || prev[prev.length - 1].id !== lastMsg.id)) {
          postMessageToServer(lastMsg);
        }
        return resolved;
      });
    } else {
      resolved = newMessages;
      setMessages(newMessages);
      const lastMsg = resolved[resolved.length - 1];
      if (lastMsg && (!messages.length || messages[messages.length - 1].id !== lastMsg.id)) {
        postMessageToServer(lastMsg);
      }
    }
  };

  const postMessageToServer = (msg: ChatMessage) => {
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    }).catch(err => console.error('Error sending intercom message:', err));
  };

  return (
    <div className="flex h-screen bg-neutral-100 font-sans tracking-tight overflow-hidden text-neutral-900 selection:bg-neutral-200">
      
      {/* Sidebar Navigation - Luxury Noir */}
      <aside className="w-20 lg:w-72 bg-black border-r border-neutral-900 flex flex-col print:hidden transition-all duration-300 z-50">
        <div className="h-24 flex items-center justify-center lg:justify-start lg:px-8 border-b border-neutral-900 text-white">
          <div className="hidden lg:flex items-center gap-3 text-left">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="max-h-12 w-auto object-contain rounded" referrerPolicy="no-referrer" />
            ) : null}
            <div>
              <span className="font-black text-2xl tracking-tighter text-white uppercase leading-none block">{settings?.storeName?.split(' ')[0] || 'ZARA'}</span>
              <span className="font-semibold text-[10px] tracking-[0.3em] text-neutral-500 uppercase leading-none mt-1 block">{settings?.storeName?.split(' ').slice(1).join(' ') || 'GALLERY'}</span>
            </div>
          </div>
          <div className="lg:hidden font-black text-2xl tracking-tighter text-white">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Z" className="w-10 h-10 object-contain rounded" referrerPolicy="no-referrer" />
            ) : "Z"}
          </div>
        </div>
        
        {/* User Session Info */}
        <div className="px-4 lg:px-8 py-6 border-b border-neutral-900 flex items-center justify-center lg:justify-between">
           <div className="hidden lg:block">
             <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mb-1">Employé Actif</p>
             <p className="text-white font-medium truncate pr-2 tracking-tight overflow-hidden w-40" title={currentUser.name}>{currentUser.name}</p>
             <p className="text-zinc-500 text-[9px] mt-0.5 font-black tracking-widest uppercase">{currentUser.role} </p>
           </div>
           <div className="flex gap-2">
             <button onClick={() => setIsChatOpen(true)} className="p-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors border border-neutral-800 relative">
               <MessageSquare className="w-4 h-4" />
               <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
             </button>
             <button onClick={handleLogout} className="p-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors border border-neutral-800" title="Quitter Session">
               <LogOut className="w-4 h-4" />
             </button>
           </div>
        </div>

        <nav className="flex-1 py-8 flex flex-col gap-1.5 px-3 lg:px-5 overflow-y-auto hide-scrollbar">
          <NavItem id="pos" icon={<ShoppingCart />} label="Vente / Caisse" active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} />
          <NavItem id="history" icon={<ReceiptText />} label="Historique Ventes" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavItem id="cash" icon={<Store />} label="Gestion de Caisse" active={activeTab === 'cash'} onClick={() => setActiveTab('cash')} />
          {/* GROS / B2B SECTION */}
          {hasAppAccess('canViewWholesale', isManager) && (
            <>
              <div className="my-3 border-t border-neutral-900 mx-3 opacity-30"></div>
              <p className="hidden lg:block px-4 text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-1">Gros / B2B</p>
              <NavItem id="wholesale" icon={<Boxes />} label="Espace Grossistes" active={activeTab === 'wholesale'} onClick={() => setActiveTab('wholesale')} />
            </>
          )}

          {/* INVENTAIRE SECTION */}
          {hasAppAccess('canViewInventory', isManager) && (
            <>
              <div className="my-3 border-t border-neutral-900 mx-3 opacity-30"></div>
              <p className="hidden lg:block px-4 text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-1">Inventaire</p>
              <NavItem id="inventory" icon={<Package />} label="Articles & Stocks" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
            </>
          )}

          {/* DIRECTION SECTION */}
          {(hasAppAccess('canViewStats', isManager) || hasAppAccess('canViewCRM', isManager)) && (
            <>
              <div className="my-3 border-t border-neutral-900 mx-3 opacity-30"></div>
              <p className="hidden lg:block px-4 text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-1">Direction</p>
              {hasAppAccess('canViewStats', isManager) && (
                <NavItem id="dashboard" icon={<BarChart3 />} label="Statistiques" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              )}
              {hasAppAccess('canViewCRM', isManager) && (
                <NavItem id="crm" icon={<Users2 />} label="Fidélité Clients" active={activeTab === 'crm'} onClick={() => setActiveTab('crm')} />
              )}
            </>
          )}

          {/* PARAMÈTRES / CONFIGURATION SECTION */}
          {(hasAppAccess('canViewPromotions', isAdmin) || hasAppAccess('canViewUsers', isAdmin) || hasAppAccess('canViewAudit', isAdmin)) && (
            <>
              <div className="my-3 border-t border-neutral-900 mx-3 opacity-30"></div>
              <p className="hidden lg:block px-4 text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-1">Paramètres</p>
              {hasAppAccess('canViewPromotions', isAdmin) && (
                <NavItem id="promotions" icon={<ImageIcon />} label="Promotions" active={activeTab === 'promotions'} onClick={() => setActiveTab('promotions')} />
              )}
              {hasAppAccess('canViewUsers', isAdmin) && (
                <NavItem id="users" icon={<Users />} label="Gestion Équipe" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
              )}
              {hasAppAccess('canViewAudit', isAdmin) && (
                <NavItem id="audit" icon={<ShieldCheck />} label="Journal d'Audit" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
              )}
            </>
          )}
          
          <div className="mt-auto pt-6 px-1 lg:px-2">
             <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center lg:justify-start px-4 py-3 bg-red-950/30 hover:bg-red-600 border border-red-900/50 hover:border-red-500 text-red-500 hover:text-white rounded-lg transition-all duration-200 group"
             >
                <LogOut className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span className="ml-4 text-[11px] hidden lg:block uppercase tracking-[0.2em] font-black">Retour au Login</span>
             </button>
          </div>
        </nav>
        
        <div className="p-5 hidden lg:block">
          <div className="bg-neutral-950 border border-neutral-900 p-4 text-[9px] text-neutral-600 uppercase tracking-widest text-center flex flex-col gap-2">
             <div className="flex items-center justify-center gap-2">
               {serverOnline ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
               <span className={`${serverOnline ? 'text-green-500' : 'text-red-500'} font-black`}>
                 {serverOnline ? 'SYNC OK' : 'LOCAL CACHE'}
               </span>
               {isSyncing === 'SYNCING' && <div className="w-1 h-1 bg-white rounded-full animate-ping"></div>}
             </div>
             <span>© 2026 ZARA GALLERY</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white relative">
        <div className={`absolute top-4 right-4 z-[999] px-4 py-2 border rounded shadow-md font-bold uppercase tracking-widest text-[9px] transition-all duration-300 ${isSyncing === 'SYNCING' ? 'bg-amber-100 border-amber-300 text-amber-800 opacity-100 translate-y-0' : (isSyncing === 'SAVED' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 opacity-100 translate-y-0' : 'bg-emerald-100 border-emerald-300 text-emerald-800 opacity-0 -translate-y-4 pointer-events-none')}`}>
           {isSyncing === 'SYNCING' ? 'Enregistrement en cours...' : 'Modifications sauvegardées'}
        </div>
        
        {activeTab === 'pos' && (
          <POS 
            products={products} 
            currentUser={currentUser!} 
            onCompleteOrder={handleCompleteOrder} 
            promotions={promotions} 
            customers={customers} 
            addAuditLog={addAuditLog} 
            pendingTickets={pendingTickets} 
            setPendingTickets={setPendingTickets} 
            setCustomers={setCustomersFromCRM}
            isPaymentLocked={settings.isPaymentLocked}
            onLogout={handleLogout}
            currentSession={currentSession}
            isCashSessionRequired={settings.isCashSessionRequired}
            settings={settings}
            onOpenSession={(startingFloat) => {
              const newSession: CashRegisterSession = {
                id: `SESS-${Date.now()}`,
                openerId: currentUser?.name || 'Inconnu',
                openedAt: new Date().toISOString(),
                status: 'OPEN',
                expectedCash: startingFloat
              };
              setCurrentSession(newSession);

              // Create cash movement for initial starting cash
              const openingMovement: CashMovement = {
                id: `MOV-${Date.now()}`,
                type: 'IN',
                amount: startingFloat,
                reason: 'Ouverture de Caisse - Fond de caisse initial',
                date: new Date().toISOString(),
                user: currentUser?.name || 'Inconnu'
              };
              setCashMovements(prev => [openingMovement, ...prev]);
              addAuditLog('SESSION_OPENED', `Session de caisse ouverte par ${currentUser?.name || 'Inconnu'}. Fond de caisse initial: ${startingFloat} F CFA.`);
            }}
          />
        )}
        {activeTab === 'inventory' && hasAppAccess('canViewInventory', isManager) && <Inventory products={products} setProducts={setProductsFromInventory} movements={stockMovements} trackMovement={trackStockMovement} />}
        {activeTab === 'wholesale' && hasAppAccess('canViewWholesale', isManager) && (
          <WholesaleManager 
            products={products}
            setProducts={setProductsFromInventory}
            wholesaleOrders={wholesaleOrders}
            setWholesaleOrders={setWholesaleOrders}
            wholesalers={wholesalers}
            setWholesalers={setWholesalers}
            trackMovement={trackStockMovement}
            addAuditLog={addAuditLog}
            currentUser={currentUser!}
            isPaymentLocked={settings.isPaymentLocked}
            isCashSessionRequired={settings.isCashSessionRequired}
            currentSession={currentSession}
            settings={settings}
          />
        )}
        {activeTab === 'dashboard' && hasAppAccess('canViewStats', isManager) && (
          <Dashboard 
            orders={orders} 
            wholesaleOrders={wholesaleOrders} 
            wholesalers={wholesalers} 
            cashMovements={cashMovements}
            settings={settings}
          />
        )}
        {activeTab === 'cash' && (
          <CashManagement 
            movements={cashMovements} 
            setMovements={setCashMovementsFromCash} 
            currentUser={currentUser!} 
            orders={orders}
            wholesaleOrders={wholesaleOrders}
            currentSession={currentSession}
            setCurrentSession={setCurrentSession}
            sessionsHistory={sessionsHistory}
            setSessionsHistory={setSessionsHistory}
            addAuditLog={addAuditLog}
            isCashSessionRequired={settings.isCashSessionRequired}
            settings={settings}
          />
        )}
        {activeTab === 'users' && hasAppAccess('canViewUsers', isAdmin) && (
          <TeamManagement 
            users={users} 
            setUsers={setUsersFromTeam} 
            currentUser={currentUser} 
            settings={settings} 
            setSettings={setSettingsFromTeam} 
            onDownloadBackup={downloadDatabase}
            products={products}
            setProducts={setProducts}
            orders={orders}
            setOrders={setOrders}
            customers={customers}
            setCustomers={setCustomers}
            promotions={promotions}
            setPromotions={setPromotions}
            cashMovements={cashMovements}
            setCashMovements={setCashMovements}
            auditLogs={auditLogs}
            setAuditLogs={setAuditLogs}
            stockMovements={stockMovements}
            setStockMovements={setStockMovements}
            wholesalers={wholesalers}
            setWholesalers={setWholesalers}
            wholesaleOrders={wholesaleOrders}
            setWholesaleOrders={setWholesaleOrders}
            currentSession={currentSession}
            setCurrentSession={setCurrentSession}
            sessionsHistory={sessionsHistory}
            setSessionsHistory={setSessionsHistory}
            messages={messages}
            setMessages={setMessages}
            pendingTickets={pendingTickets}
            setPendingTickets={setPendingTickets}
          />
        )}
        {activeTab === 'crm' && hasAppAccess('canViewCRM', isManager) && <CRM customers={customers} setCustomers={setCustomersFromCRM} orders={orders} settings={settings} />}
        {activeTab === 'promotions' && hasAppAccess('canViewPromotions', isAdmin) && <PromotionManager promotions={promotions} setPromotions={setPromotionsFromManager} settings={settings} />}
        {activeTab === 'audit' && hasAppAccess('canViewAudit', isAdmin) && <AuditLog logs={auditLogs} />}
        {activeTab === 'history' && <SalesHistory orders={orders} wholesaleOrders={wholesaleOrders} wholesalers={wholesalers} currentUser={currentUser} users={users} settings={settings} />}
        
        <Chat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={messages} setMessages={setMessagesFromChat} currentUser={currentUser} users={users} />
      </main>
    </div>
  );
}

function NavItem({ id, icon, label, active, onClick }: { id: string, icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center lg:justify-start w-full px-4 py-3 rounded-lg transition-all duration-200 group relative ${
        active 
          ? 'bg-white text-black shadow-lg shadow-black/5' 
          : 'text-neutral-500 hover:bg-neutral-900 hover:text-white'
      }`}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-black rounded-r-full hidden lg:block"></div>}
      <div className={`w-4 h-4 transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
      <span className={`ml-4 text-[11px] hidden lg:block uppercase tracking-[0.2em] font-black ${active ? 'text-black' : ''}`}>{label}</span>
    </button>
  );
}
