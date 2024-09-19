import React, { createContext, useState, useContext } from 'react';

// Create a Context for the authentication state
const AuthContext = createContext();

// Create a Provider component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for JWT token in localStorage when the provider mounts
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use authentication context
export const useAuth = () => {
  return useContext(AuthContext);
};
