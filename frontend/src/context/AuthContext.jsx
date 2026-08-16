import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('scaleflow_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('scaleflow_token'));
  const [cart, setCart] = useState(() => {
    const storedCart = localStorage.getItem('scaleflow_cart');
    return storedCart ? JSON.parse(storedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem('scaleflow_cart', JSON.stringify(cart));
  }, [cart]);

  const login = async (email, password) => {
    const resp = await api.post('/auth/login', { email, password });
    const { access_token, user_id, role, full_name } = resp.data;
    const userData = { id: user_id, email, role, full_name };
    
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('scaleflow_token', access_token);
    localStorage.setItem('scaleflow_user', JSON.stringify(userData));
    return userData;
  };

  const register = async (email, password, full_name, role = 'CUSTOMER') => {
    const resp = await api.post('/auth/register', { email, password, full_name, role });
    const { access_token, user_id } = resp.data;
    const userData = { id: user_id, email, role, full_name };
    
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('scaleflow_token', access_token);
    localStorage.setItem('scaleflow_user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setCart([]);
    localStorage.removeItem('scaleflow_token');
    localStorage.removeItem('scaleflow_user');
    localStorage.removeItem('scaleflow_cart');
  };

  const addToCart = (product, quantity = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...prevCart, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        cart,
        login,
        register,
        logout,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
