import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, MapPin, Package, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Address {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  is_default: boolean;
}

const CheckoutPage: React.FC = () => {
  const { user } = useAuth();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const subtotal = getCartTotal();
  const shipping = subtotal > 500 ? 0 : 50;
  const total = subtotal + shipping;

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    if (cartItems.length === 0) {
      navigate('/cart');
      return;
    }

    fetchUserData();
  }, [user, cartItems, navigate]);

  const fetchUserData = async () => {
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user?.id)
        .single();

      setUserProfile(profile);

      if (profile) {
        // Get addresses
        const { data: addressesData } = await supabase
          .from('user_addresses')
          .select('*')
          .eq('user_id', profile.id)
          .order('is_default', { ascending: false });

        setAddresses(addressesData || []);
        
        // Set default address
        const defaultAddress = addressesData?.find(addr => addr.is_default);
        if (defaultAddress) {
          setSelectedAddress(defaultAddress);
        } else if (addressesData && addressesData.length > 0) {
          setSelectedAddress(addressesData[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const createOrder = async () => {
    if (!userProfile || !selectedAddress) return null;

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .insert([{
          user_id: userProfile.id,
          address_id: selectedAddress.id,
          total_amount: total,
          payment_status: 'pending',
          order_status: 'processing',
          shipping_method: 'standard',
          shipping_cost: shipping,
          payment_method: paymentMethod
        }])
        .select()
        .single();

      if (error) throw error;

      // Add order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        price: item.price_at_time
      }));

      await supabase
        .from('order_items')
        .insert(orderItems);

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      setLoading(true);

      // Create order in database
      const order = await createOrder();
      if (!order) throw new Error('Failed to create order');

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: 'rzp_test_1234567890', // Replace with your Razorpay key
          amount: total * 100, // Amount in paise
          currency: 'INR',
          name: 'RegionalMart',
          description: 'Order Payment',
          order_id: `order_${order.id}`,
          handler: async (response: any) => {
            try {
              // Update order with payment details
              await supabase
                .from('orders')
                .update({
                  payment_status: 'completed',
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id
                })
                .eq('id', order.id);

              // Clear cart
              await clearCart();

              // Redirect to success page
              navigate(`/order-success/${order.id}`);
            } catch (error) {
              console.error('Error updating payment:', error);
              alert('Payment successful but order update failed. Please contact support.');
            }
          },
          prefill: {
            name: `${userProfile.first_name} ${userProfile.last_name}`,
            email: userProfile.email,
            contact: userProfile.mobile || ''
          },
          theme: {
            color: '#F97316'
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };

      script.onerror = () => {
        throw new Error('Failed to load Razorpay');
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCashOnDelivery = async () => {
    try {
      setLoading(true);

      const order = await createOrder();
      if (!order) throw new Error('Failed to create order');

      // Update payment method
      await supabase
        .from('orders')
        .update({
          payment_status: 'pending',
          payment_method: 'cod'
        })
        .eq('id', order.id);

      // Clear cart
      await clearCart();

      // Redirect to success page
      navigate(`/order-success/${order.id}`);
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = () => {
    if (!selectedAddress) {
      alert('Please select a delivery address');
      return;
    }

    if (paymentMethod === 'razorpay') {
      handleRazorpayPayment();
    } else {
      handleCashOnDelivery();
    }
  };

  if (!user || cartItems.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="h-6 w-6 text-orange-500" />
                <h2 className="text-xl font-semibold text-gray-900">Delivery Address</h2>
              </div>

              {addresses.length > 0 ? (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedAddress?.id === address.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={address.id}
                        checked={selectedAddress?.id === address.id}
                        onChange={() => setSelectedAddress(address)}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">
                            {address.label}
                            {address.is_default && (
                              <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-gray-700 text-sm">
                            <p>{address.address_line1}</p>
                            {address.address_line2 && <p>{address.address_line2}</p>}
                            <p>{address.city}, {address.state} {address.pincode}</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No addresses found</p>
                  <button
                    onClick={() => navigate('/addresses')}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Add Address
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="h-6 w-6 text-orange-500" />
                <h2 className="text-xl font-semibold text-gray-900">Payment Method</h2>
              </div>

              <div className="space-y-3">
                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="razorpay"
                    checked={paymentMethod === 'razorpay'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">Online Payment</div>
                    <div className="text-sm text-gray-600">Pay securely with Razorpay (Cards, UPI, Net Banking)</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">Cash on Delivery</div>
                    <div className="text-sm text-gray-600">Pay when your order is delivered</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>

              {/* Order Items */}
              <div className="space-y-3 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img
                      src={item.product_image || 'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=100'}
                      alt={item.product_name}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{item.product_name}</p>
                      <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-sm">{formatPrice(item.price_at_time * item.quantity)}</p>
                  </div>
                ))}
              </div>

              {/* Pricing */}
              <div className="space-y-3 mb-6 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {shipping === 0 ? 'Free' : formatPrice(shipping)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-center">
                <div className="flex flex-col items-center">
                  <Shield className="h-6 w-6 text-green-600 mb-1" />
                  <span className="text-xs text-gray-600">Secure Payment</span>
                </div>
                <div className="flex flex-col items-center">
                  <Package className="h-6 w-6 text-blue-600 mb-1" />
                  <span className="text-xs text-gray-600">Fast Delivery</span>
                </div>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={loading || !selectedAddress}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-semibold transition-colors"
              >
                {loading ? 'Processing...' : `Place Order - ${formatPrice(total)}`}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                By placing your order, you agree to our Terms & Conditions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;