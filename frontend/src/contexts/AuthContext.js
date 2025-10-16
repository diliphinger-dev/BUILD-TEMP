import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper functions for improved token handling
  const getStoredToken = () => {
    return localStorage.getItem('ca_auth_token') || 
           localStorage.getItem('token') || 
           localStorage.getItem('authToken') ||
           localStorage.getItem('auth_token');
  };

  const setStoredToken = (newToken) => {
    // Store in primary location and clean up others
    localStorage.setItem('ca_auth_token', newToken);
    localStorage.setItem('token', newToken); // Keep for compatibility
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_token');
  };

  const removeStoredToken = () => {
    // Remove all possible token keys
    localStorage.removeItem('ca_auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_token');
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = getStoredToken();
        const storedUser = localStorage.getItem('user');
        const storedFirm = localStorage.getItem('selectedFirm');
        
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          const response = await axios.get('/api/auth/verify');
          
          if (response.data.success) {
            setUser(response.data.user);
            
            if (storedFirm) {
              setSelectedFirm(JSON.parse(storedFirm));
            } else {
              const firmsResponse = await axios.get('/api/firms/my-firms');
              if (firmsResponse.data.success && firmsResponse.data.data.length > 0) {
                const primaryFirm = firmsResponse.data.data.find(f => f.is_primary) || firmsResponse.data.data[0];
                setSelectedFirm(primaryFirm);
                localStorage.setItem('selectedFirm', JSON.stringify(primaryFirm));
              }
            }
          } else {
            removeStoredToken();
            localStorage.removeItem('user');
            localStorage.removeItem('selectedFirm');
            delete axios.defaults.headers.common['Authorization'];
          }
        } else if (storedUser) {
          setUser(JSON.parse(storedUser));
          
          if (storedFirm) {
            setSelectedFirm(JSON.parse(storedFirm));
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (error.response?.status === 401) {
          console.log('Token expired or invalid, clearing auth state');
        }
        removeStoredToken();
        localStorage.removeItem('user');
        localStorage.removeItem('selectedFirm');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const credentials = typeof email === 'object' ? email : { email, password };
      
      const response = await axios.post('/api/auth/login', credentials);

      if (response.data.success) {
        const { token, user } = response.data;
        
        setStoredToken(token);
        localStorage.setItem('user', JSON.stringify(user));
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(user);
        
        try {
          const firmsResponse = await axios.get('/api/firms/my-firms');
          if (firmsResponse.data.success && firmsResponse.data.data.length > 0) {
            const primaryFirm = firmsResponse.data.data.find(f => f.is_primary) || firmsResponse.data.data[0];
            setSelectedFirm(primaryFirm);
            localStorage.setItem('selectedFirm', JSON.stringify(primaryFirm));
          }
        } catch (firmError) {
          console.error('Failed to fetch firms:', firmError);
        }
        
        return { success: true };
      }
      
      return { 
        success: false, 
        error: response.data.message || 'Login failed',
        message: response.data.message || 'Login failed',
        response: response.data  // ✅ ADDED: Pass full response for emergency_mode
      };
    } catch (error) {
      // ✅ CRITICAL FIX: Return full error response including emergency_mode
      const errorData = error.response?.data || {};
      
      return { 
        success: false, 
        error: errorData.message || 'Network error',
        message: errorData.message || 'Network error',
        response: errorData  // ✅ ADDED: Passes emergency_mode, attempts_remaining, etc.
      };
    }
  };

  const logout = () => {
    removeStoredToken();
    localStorage.removeItem('user');
    localStorage.removeItem('selectedFirm');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setSelectedFirm(null);
  };

  const updateSelectedFirm = (firm) => {
    setSelectedFirm(firm);
    localStorage.setItem('selectedFirm', JSON.stringify(firm));
  };

  const value = {
    user,
    selectedFirm,
    setSelectedFirm: updateSelectedFirm,
    updateSelectedFirm,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;