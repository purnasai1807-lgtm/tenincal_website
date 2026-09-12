import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Sparkles, 
  Calendar, 
  ShieldCheck, 
  Heart, 
  MapPin, 
  ExternalLink,
  ChevronRight,
  Server,
  Ticket,
  Lock
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { WorkshopHero } from './components/WorkshopHero';
import { EventCatalog } from './components/EventCatalog';
import { RegistrationModal } from './components/RegistrationModal';
import { RegistrationSuccessModal } from './components/RegistrationSuccessModal';
import { AdminDashboard } from './components/AdminDashboard';
import { MemberDashboard } from './components/MemberDashboard';
import { LoadBalancerMonitor } from './components/LoadBalancerMonitor';
import { AuthModal } from './components/AuthModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { PrintableRosterModal } from './components/PrintableRosterModal';
import { VenueCheckInModal } from './components/VenueCheckInModal';
import { FireworksOverlay } from './components/FireworksOverlay';
import { api, authStorage } from './services/api';
import { User, EventItem, StudentRegistration, NotificationItem } from './types';
import { CelebrationInfo } from './components/FireworksOverlay';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(authStorage.getUser());
  const [activeTab, setActiveTab] = useState<'home' | 'events' | 'student-portal' | 'admin-dashboard' | 'load-balancer'>('home');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const lastCelebrationIdRef = useRef<string | null>(null);

  // Modals state
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [selectedEventIdForReg, setSelectedEventIdForReg] = useState<string>('');
  const [successRegistration, setSuccessRegistration] = useState<StudentRegistration | null>(null);
  
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState(false);

  const [printRosterOpen, setPrintRosterOpen] = useState(false);
  const [rosterStudents, setRosterStudents] = useState<StudentRegistration[]>([]);

  // Venue Check-in Modal state when student scans QR code
  const [venueCheckInModalOpen, setVenueCheckInModalOpen] = useState(false);
  const [checkInEvent, setCheckInEvent] = useState<EventItem | null>(null);
  const [checkInToken, setCheckInToken] = useState<string | undefined>(undefined);

  // Initial Data Fetch
  useEffect(() => {
    // Verify session
    if (authStorage.getToken()) {
      api.getMe()
        .then((res) => {
          if (res.user) {
            setCurrentUser(res.user);
            authStorage.setUser(res.user);
          }
        })
        .catch(() => {
          authStorage.clear();
          setCurrentUser(null);
        });
    }

    // Load Events Catalog
    api.getEvents()
      .then(setEvents)
      .catch((err) => console.error('Error loading events:', err));

    // Load Notifications Feed
    api.getNotifications()
      .then(setNotifications)
      .catch((err) => console.error('Error loading notifications:', err));
  }, []);

  // Poll the public celebration endpoint so every open client sees fireworks
  // after an admin launches them from another browser/session.
  useEffect(() => {
    let disposed = false;

    const syncCelebration = async () => {
      try {
        const result = await api.getCurrentCelebration();
        if (disposed) return;

        if (result.active && result.celebration) {
          const nextId = String(result.celebration.id || '');
          if (nextId && nextId !== lastCelebrationIdRef.current) {
            lastCelebrationIdRef.current = nextId;
            setCelebration(result.celebration as CelebrationInfo);
          }
        } else {
          lastCelebrationIdRef.current = null;
          setCelebration(null);
        }
      } catch (error) {
        console.error('Error syncing celebration:', error);
      }
    };

    syncCelebration();
    const intervalId = window.setInterval(syncCelebration, 1000);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Private Admin Route & Keyboard Shortcut Listener
  useEffect(() => {
    const checkAdminRoute = () => {
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (hash === '#admin' || hash === '#admin-login' || hash === '#console' || params.get('admin') === 'true') {
        if (currentUser?.role === 'admin') {
          setActiveTab('admin-dashboard');
        } else {
          setAdminLoginModalOpen(true);
        }
      }
    };

    checkAdminRoute();
    window.addEventListener('hashchange', checkAdminRoute);

    // Discrete Admin shortcut: Ctrl+Shift+A or Cmd+Shift+A
    const handleAdminKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (currentUser?.role === 'admin') {
          setActiveTab('admin-dashboard');
        } else {
          setAdminLoginModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleAdminKey);
    return () => {
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('keydown', handleAdminKey);
    };
  }, [currentUser]);

  // Listen for #checkin route when student scans event QR code
  useEffect(() => {
    const checkVenueRoute = () => {
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);

      if (hash.startsWith('#checkin') || searchParams.has('checkin')) {
        let eventId = searchParams.get('checkin') || searchParams.get('event');
        let token = searchParams.get('token') || undefined;

        if (hash.startsWith('#checkin')) {
          const hashQueryIndex = hash.indexOf('?');
          if (hashQueryIndex !== -1) {
            const hashParams = new URLSearchParams(hash.slice(hashQueryIndex));
            eventId = hashParams.get('event') || eventId;
            token = hashParams.get('token') || token;
          }
        }

        if (eventId && events.length > 0) {
          const found = events.find((e) => e.id === eventId) || events[0];
          setCheckInEvent(found);
          setCheckInToken(token);
          setVenueCheckInModalOpen(true);
        } else if (events.length > 0) {
          setCheckInEvent(events[0]);
          setVenueCheckInModalOpen(true);
        }
      }
    };

    checkVenueRoute();
    window.addEventListener('hashchange', checkVenueRoute);
    return () => window.removeEventListener('hashchange', checkVenueRoute);
  }, [events]);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    if (activeTab === 'admin-dashboard' || activeTab === 'student-portal') {
      setActiveTab('home');
    }
  };

  const handleOpenRegister = (eventId?: string) => {
    if (eventId) {
      setSelectedEventIdForReg(eventId);
    } else if (events.length > 0) {
      setSelectedEventIdForReg(events[0].id);
    }
    setRegistrationModalOpen(true);
  };

  const handleRegistrationComplete = (reg: StudentRegistration) => {
    setSuccessRegistration(reg);
    // Refresh events to update live seats count
    api.getEvents().then(setEvents).catch(() => {});
    api.getNotifications().then(setNotifications).catch(() => {});
  };

  const handleOpenPrintRoster = (students: StudentRegistration[]) => {
    setRosterStudents(students);
    setPrintRosterOpen(true);
  };

  const workshopEvent = events.find((e) => e.category === 'workshop') || events[0];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={(mode = 'login') => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        notifications={notifications}
        onOpenRegisterModal={() => handleOpenRegister()}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <>
            <WorkshopHero
              workshopEvent={workshopEvent}
              onRegisterClick={handleOpenRegister}
              onExploreEvents={() => setActiveTab('events')}
              currentUser={currentUser}
              onOpenEventModal={() => setActiveTab('admin-dashboard')}
            />
            {/* Quick Catalog Teaser */}
            <EventCatalog
              events={events}
              onSelectEvent={(ev) => handleOpenRegister(ev.id)}
              onRegisterClick={handleOpenRegister}
              currentUser={currentUser}
              onOpenEventModal={() => setActiveTab('admin-dashboard')}
            />
          </>
        )}

        {activeTab === 'events' && (
          <EventCatalog
            events={events}
            onSelectEvent={(ev) => handleOpenRegister(ev.id)}
            onRegisterClick={handleOpenRegister}
            currentUser={currentUser}
            onOpenEventModal={() => setActiveTab('admin-dashboard')}
          />
        )}

        {activeTab === 'student-portal' && (
          <MemberDashboard
            currentUser={currentUser}
            events={events}
            notifications={notifications}
            onOpenAuth={() => {
              setAuthModalMode('login');
              setAuthModalOpen(true);
            }}
            onSelectRegistration={(reg) => setSuccessRegistration(reg)}
            onBrowseEvents={() => setActiveTab('events')}
          />
        )}

        {activeTab === 'admin-dashboard' && (
          <AdminDashboard
            currentUser={currentUser}
            onOpenAuth={() => setAdminLoginModalOpen(true)}
            onOpenPrintRoster={handleOpenPrintRoster}
            onTriggerCelebration={(nextCelebration) => {
              lastCelebrationIdRef.current = String(nextCelebration.id || '');
              setCelebration(nextCelebration as CelebrationInfo);
            }}
          />
        )}

        {activeTab === 'load-balancer' && <LoadBalancerMonitor />}
      </main>

      <FireworksOverlay
        celebration={celebration}
        canStop={currentUser?.role === 'admin'}
        onStop={() => {
          api.stopCelebration()
            .then(() => {
              lastCelebrationIdRef.current = null;
              setCelebration(null);
            })
            .catch((error) => console.error('Error stopping celebration:', error));
        }}
      />

      {/* Institutional Footer */}
      <footer className="border-t border-slate-800 bg-[#080c13] py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <span className="font-extrabold text-white text-sm">SYNAPSE CLUB × WiDS ACEEC</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-xs">
                Department of Computer Science & Design (CSD), ACE Engineering College. Empowering students through data science, AI engineering, and hackathon culture.
              </p>
            </div>

            <div>
              <h5 className="font-bold text-white mb-3 font-mono text-[11px] uppercase tracking-wider">
                Technical Programs
              </h5>
              {events.length > 0 ? (
                <ul className="space-y-2">
                  {events.slice(0, 4).map((ev) => (
                    <li key={ev.id}>
                      <button
                        onClick={() => {
                          setActiveTab('events');
                          handleOpenRegister(ev.id);
                        }}
                        className="hover:text-cyan-300 transition-colors text-left"
                      >
                        {ev.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2 text-xs text-slate-400">
                  <li>
                    <button onClick={() => setActiveTab('events')} className="hover:text-cyan-300 transition-colors text-left">
                      Technical Events Catalog
                    </button>
                  </li>
                  <li className="text-[11px] text-slate-500 italic">
                    Programs published live by admin
                  </li>
                </ul>
              )}
            </div>

            <div>
              <h5 className="font-bold text-white mb-3 font-mono text-[11px] uppercase tracking-wider">
                Platform Portals
              </h5>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => setActiveTab('student-portal')} className="hover:text-cyan-300 transition-colors flex items-center gap-1">
                    <span>Attendee Pass Portal</span>
                  </button>
                </li>
                {currentUser?.role === 'admin' && (
                  <li>
                    <button onClick={() => setActiveTab('admin-dashboard')} className="hover:text-fuchsia-300 transition-colors flex items-center gap-1.5 text-fuchsia-300 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-fuchsia-400" />
                      <span>Admin Console (Active)</span>
                    </button>
                  </li>
                )}
                <li>
                  <button onClick={() => setActiveTab('load-balancer')} className="hover:text-cyan-300 transition-colors flex items-center gap-1 font-mono">
                    <span>2k+ Concurrency Cluster</span>
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-white mb-3 font-mono text-[11px] uppercase tracking-wider">
                Campus Location
              </h5>
              <div className="space-y-2 text-slate-400">
                <p className="flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-fuchsia-400 shrink-0 mt-0.5" />
                  <span>ACE Engineering College, Ankushapur, Ghatkesar, Hyderabad, Telangana 501301</span>
                </p>
                <p className="font-mono text-slate-500 text-[11px]">
                  Venue: Computer Science Lab 4 & Auditorium
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
            <div className="flex items-center gap-3">
              <p>© 2026 Synapse Club × WiDS ACEEC Chapter. All rights reserved.</p>
              <span>•</span>
              <button
                onClick={() => {
                  if (currentUser?.role === 'admin') {
                    setActiveTab('admin-dashboard');
                  } else {
                    setAdminLoginModalOpen(true);
                  }
                }}
                className="text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1 text-[11px]"
                title="Private Staff Gateway (Ctrl+Shift+A or /#admin)"
              >
                <Lock className="w-3 h-3" />
                <span>Staff Access</span>
              </button>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span>JWT + AES-256 Storage</span>
              <span>•</span>
              <span>Sub-15ms Latency</span>
              <span>•</span>
              <span className="text-cyan-400">Cluster Status: Healthy</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <RegistrationModal
        isOpen={registrationModalOpen}
        onClose={() => setRegistrationModalOpen(false)}
        events={events}
        defaultEventId={selectedEventIdForReg}
        currentUser={currentUser}
        onRegistrationSuccess={handleRegistrationComplete}
      />

      <RegistrationSuccessModal
        registration={successRegistration}
        onClose={() => setSuccessRegistration(null)}
        onOpenPortal={() => {
          setSuccessRegistration(null);
          setActiveTab('student-portal');
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'admin') {
            setActiveTab('admin-dashboard');
          } else {
            setActiveTab('student-portal');
          }
        }}
      />

      {/* Private Restricted Admin Login Gateway */}
      <AdminLoginModal
        isOpen={adminLoginModalOpen}
        onClose={() => {
          setAdminLoginModalOpen(false);
          if (window.location.hash === '#admin' || window.location.hash === '#admin-login' || window.location.hash === '#console') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
        onAdminAuthSuccess={(adminUser) => {
          setCurrentUser(adminUser);
          authStorage.setUser(adminUser);
          setActiveTab('admin-dashboard');
          api.getEvents().then(setEvents).catch(() => {});
        }}
      />

      <PrintableRosterModal
        isOpen={printRosterOpen}
        onClose={() => setPrintRosterOpen(false)}
        students={rosterStudents}
      />

      {/* Student Venue Check-in Modal triggered by scanning event QR code */}
      <VenueCheckInModal
        isOpen={venueCheckInModalOpen}
        onClose={() => {
          setVenueCheckInModalOpen(false);
          // If hash had #checkin, clean it up gracefully
          if (window.location.hash.startsWith('#checkin')) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
        event={checkInEvent}
        events={events}
        onEventSelect={(ev) => setCheckInEvent(ev)}
        venueToken={checkInToken}
      />
    </div>
  );
}
