import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag, CreditCard } from 'lucide-react';

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, getTotal } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16" style={{ backgroundColor: 'var(--section-bg-light)' }}>
        <div className="text-center">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Your cart is empty</h1>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Add some products to get started</p>
          <Link to="/shop"><Button>Browse Products</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--section-bg-light)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Shopping Cart</h1>
          <button onClick={() => navigate(-1)} className="flex items-center" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continue Shopping
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.productId}>
                <CardContent className="flex items-center gap-4 p-4">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded" />
                  ) : (
                    <div className="w-20 h-20 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                      <ShoppingBag className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{formatCurrency(item.price)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center" style={{ color: 'var(--text-primary)' }}>{item.quantity}</span>
                    <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.price * item.quantity)}</p>
                    <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Order Summary</h2>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(getTotal())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Shipping</span>
                    <span style={{ color: 'var(--text-primary)' }}>Calculated at checkout</span>
                  </div>
                </div>
                <div className="border-t pt-4 mb-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex justify-between font-bold">
                    <span style={{ color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ color: 'var(--primary-color)' }}>{formatCurrency(getTotal())}</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => navigate('/checkout')}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Proceed to Checkout
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
