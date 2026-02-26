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
      
      if (!data) {
        console.error('User profile not found');
        return null;
      }
      
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
      const profile = await getUserProfile();
      if (!profile) throw new Error('User profile not found');

      const cart = await getOrCreateCart(profile.id);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
      if (!cart) throw new Error('Could not create cart');

      // Check if item already exists in cart
    try {
      const { data: existingItem } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id)
        .eq('variant_id', variantId)
        .single();

      if (existingItem) {
        // Update quantity
        await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);
      } else {
        // Add new item
        await supabase
          .from('cart_items')
          .insert([{
            cart_id: cart.id,
            variant_id: variantId,
            asin: asin,
            quantity: quantity,
            price_at_time: productDetails.price,
            product_name: productDetails.name,
            product_image: productDetails.image,
            variant_weight: productDetails.weight,
        const { error: updateError } = await supabase
          }]);
      }

        
        if (updateError) {
          console.error('Error updating cart item:', updateError);
          throw updateError;
        }
        
        console.log('Updated existing cart item');
      await refreshCart();
    } catch (error) {
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
        
        const { error: insertError } = await supabase
      throw error;
          .insert([cartItemData]);
        
        if (insertError) {
          console.error('Error inserting cart item:', insertError);
          throw insertError;
        }
        
        console.log('Added new cart item');
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);
      console.log('Cart refreshed after adding item');

      await refreshCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      await supabase
        .from('cart_items')
        .delete()
      const { error } = await supabase

      await refreshCart();
    } catch (error) {
      
      if (error) {
        console.error('Error updating quantity:', error);
        throw error;
      }
      console.error('Error removing from cart:', error);
      throw error;
    }
    } catch (error) {
      console.error('Error getting or creating cart:', error);
      return null;
    }
  };

  const clearCart = async () => {
      const { error } = await supabase

    try {
      const profile = await getUserProfile();
      
      if (error) {
        console.error('Error removing from cart:', error);
        throw error;
      }
      if (!profile) {
        console.error('No user profile found');
        return;
      }

      const cart = await getOrCreateCart(profile.id);
      if (!cart) {
        console.error('No cart found or created');
        return;
      }

      await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);

      console.log('Cart items fetched:', items);
      setCartItems([]);
      const { error } = await supabase
      console.error('Error clearing cart:', error);
      throw error;
    }
      
      if (error) {
        console.error('Error clearing cart:', error);
        throw error;
      }
  };

      console.log('Adding to cart:', { variantId, asin, quantity, productDetails });
      
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price_at_time * item.quantity), 0);
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

      console.log('Cart found/created:', cart);

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

      console.log('Existing item:', existingItem);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};