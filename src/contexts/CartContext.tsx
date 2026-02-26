import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface CartItem {
  id: string;
  cart_id: string; 
  variant_id: string;
  asin: string;
  quantity: number;
  price_at_time: number;
  product_name: string;
  product_image: string;
  variant_weight: number;
  variant_weight_unit: string;
  created_at: string;
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  loading: boolean;
  addToCart: (variantId: string, asin: string, quantity: number, productDetails: any) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getCartTotal: () => number;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      refreshCart();
    } else {
      setCartItems([]);
    }
  }, [user]);

  const getUserProfile = async () => {
    if (!user) return null;
    
    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  const getOrCreateCart = async (userId: string) => {
    // Check if user has a cart
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart) {
      // Create new cart
      const { data: newCart } = await supabase
        .from('carts')
        .insert([{ user_id: userId }])
        .select('id')
        .single();
      cart = newCart;
    }

    if (!cart) {
      throw new Error('Failed to create or get cart');
    }

    return cart;
  };

  const refreshCart = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const profile = await getUserProfile();
      if (!profile) return;

      const cart = await getOrCreateCart(profile.id);
      if (!cart) return;

      const { data: items } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id)
        .order('created_at', { ascending: false });

      console.log('Cart items fetched:', items);
      setCartItems(items || []);
    } catch (error) {
      console.error('Error refreshing cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (variantId: string, asin: string, quantity: number, productDetails: any) => {
    if (!user) {
      throw new Error('Please sign in to add items to cart');
    }

    try {
      console.log('Adding to cart:', { variantId, asin, quantity, productDetails });
      
      const profile = await getUserProfile();
      if (!profile) throw new Error('User profile not found');

      const cart = await getOrCreateCart(profile.id);
      if (!cart) throw new Error('Could not create cart');

      console.log('Cart found/created:', cart);

      // Check if item already exists in cart
      const { data: existingItem } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id)
        .eq('variant_id', variantId)
        .single();

      console.log('Existing item:', existingItem);

      if (existingItem) {
        // Update quantity
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);
        
        if (updateError) {
          console.error('Error updating cart item:', updateError);
          throw updateError;
        }
        
        console.log('Updated existing cart item');
      } else {
        // Add new item
        const cartItemData = {
          cart_id: cart.id,
          variant_id: variantId,
          asin: asin,
          quantity: quantity,
          price_at_time: productDetails.price,
          product_name: productDetails.name,
          product_image: productDetails.image,
          variant_weight: productDetails.weight,
          variant_weight_unit: productDetails.weightUnit
        };
        
        console.log('Inserting cart item:', cartItemData);
        
        const { data: insertedItem, error: insertError } = await supabase
          .from('cart_items')
          .insert([cartItemData])
          .select()
          .single();
        
        if (insertError) {
          console.error('Error inserting cart item:', insertError);
          throw insertError;
        }
        
        console.log('Added new cart item:', insertedItem);
      }

      await refreshCart();
      console.log('Cart refreshed after adding item');
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);
      
      if (error) {
        console.error('Error updating quantity:', error);
        throw error;
      }

      await refreshCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);
      
      if (error) {
        console.error('Error removing from cart:', error);
        throw error;
      }

      await refreshCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const profile = await getUserProfile();
      if (!profile) {
        console.error('No user profile found');
        return;
      }

      const cart = await getOrCreateCart(profile.id);
      if (!cart) {
        console.error('No cart found or created');
        return;
      }

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);
      
      if (error) {
        console.error('Error clearing cart:', error);
        throw error;
      }

      setCartItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price_at_time * item.quantity), 0);
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const value = {
    cartItems,
    cartCount,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};