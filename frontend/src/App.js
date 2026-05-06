import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import PendingRegistrationPage from './pages/PendingRegistrationPage';
import BannedPage from './pages/BannedPage';
import MainApp from './pages/MainApp';
import AdminDashboard from './pages/AdminDashboard';
import ModerationPanel from './pages/ModerationPanel';
import ManagementPanel from './pages/ManagementPanel';
import UserProfile from './pages/UserProfile';
import SettingsPage from './pages/SettingsPage';
import FriendsPage from './pages/FriendsPage';
import SearchResultsPage from './pages/SearchResultsPage';
import { Toaster } from './components/ui/sonner';

// Theme context
export const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // Determine restricted access
  const isBanned = user?.is_banned;
  const isRestricted = isBanned;

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <div className={`App ${darkMode ? 'dark' : ''}`}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={token ? <Navigate to="/" /> : <LoginPage onLogin={login} />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/pending-registration" element={<PendingRegistrationWrapper />} />
            <Route path="/banned" element={token && isBanned ? <BannedPage user={user} onLogout={logout} /> : <Navigate to="/" />} />
            <Route path="/settings" element={token && !isRestricted ? <SettingsPage user={user} onLogout={logout} updateUser={updateUser} /> : <Navigate to="/login" />} />
            <Route path="/friends" element={token && !isRestricted ? <FriendsPage user={user} /> : <Navigate to="/login" />} />
            <Route path="/search" element={token && !isRestricted ? <SearchResultsPage user={user} /> : <Navigate to="/login" />} />
            <Route path="/" element={
              token 
                ? (isBanned ? <Navigate to="/banned" /> : <MainApp user={user} onLogout={logout} updateUser={updateUser} />)
                : <Navigate to="/login" />
            } />
            <Route path="/admin" element={token && user?.is_admin && !isRestricted ? <AdminDashboard user={user} onLogout={logout} /> : <Navigate to="/" />} />
            <Route path="/moderation" element={token && user?.is_moderator && !isRestricted ? <ModerationPanel user={user} onLogout={logout} /> : <Navigate to="/" />} />
            <Route path="/management" element={token && (user?.role === 'Project Owner' || user?.role === 'Management') && !isRestricted ? <ManagementPanel user={user} onLogout={logout} /> : <Navigate to="/" />} />
            <Route path="/profile/:idNumber" element={token && !isRestricted ? <UserProfile currentUser={user} onLogout={logout} updateUser={updateUser} /> : <Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </ThemeContext.Provider>
  );
}

function PendingRegistrationWrapper() {
  return <PendingRegistrationPage />;
}

export default App;
