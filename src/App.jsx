import { useEffect, useState } from 'react';
import { Box, useToast } from '@chakra-ui/react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import QuotaBanner from './components/QuotaBanner.jsx';
import LandingPage from './pages/LandingPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import LocationModal from './components/LocationModal.jsx';
import HospitalDetailsDrawer from './components/HospitalDetailsDrawer.jsx';
import { listHospitals } from './api/hospitals.js';
import { useDebounced } from './hooks/useDebounced.js';
import { useGeolocation } from './hooks/useGeolocation.js';

const PAGE_SIZE = 100;

export default function App() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const geo = useGeolocation();

  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [tableQuery, setTableQuery] = useState('');
  const debouncedQuery = useDebounced(tableQuery, 350);
  const [page, setPage] = useState(0);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    listHospitals({
      q: debouncedQuery,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      signal: ctrl.signal,
    })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        toast({
          title: 'Failed to load directory',
          description: err.message,
          status: 'error',
          duration: 5000,
        });
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debouncedQuery, page, toast]);

  const sendChatMessage = (text) => {
    setPendingPrompt({ text, ts: Date.now() });
    if (location.pathname !== '/chat') navigate('/chat');
  };

  const findCareNearMe = async () => {
    try {
      await geo.request();
      sendChatMessage('Find the best healthcare facilities near my current location.');
    } catch {
      setShowLocationModal(true);
    }
  };

  return (
    <Box minH="100vh">
      <Navbar
        onEmergency={() => sendChatMessage('I need emergency care nearby right now')}
      />
      <QuotaBanner />
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              items={items}
              total={total}
              loading={loading}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              query={tableQuery}
              onQueryChange={setTableQuery}
              userLocation={geo.location}
              locationStatus={geo.status}
              onFindNearMe={findCareNearMe}
              onOpenChat={() => navigate('/chat')}
              onOpenDetails={setSelectedId}
            />
          }
        />
        <Route
          path="/chat"
          element={
            <ChatPage
              pendingPrompt={pendingPrompt}
              userLocation={geo.location}
              locationStatus={geo.status}
              onRequestLocation={findCareNearMe}
              onOpenDetails={setSelectedId}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
            />
          }
        />
        <Route path="/insights" element={<InsightsPage />} />
      </Routes>
      <LocationModal isOpen={showLocationModal} onClose={() => setShowLocationModal(false)} />
      <HospitalDetailsDrawer
        id={selectedId}
        onClose={() => setSelectedId(null)}
        userLocation={geo.location}
        onRequestLocation={findCareNearMe}
      />
    </Box>
  );
}
