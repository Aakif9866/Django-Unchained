import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Notes } from './pages/Notes';
import { Phase2Dashboard } from './pages/Phase2Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <Notes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/testing-dashboard"
            element={
              <ProtectedRoute>
                <Phase2Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/notes" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
