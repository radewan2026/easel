import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct } from '../../hooks/useProducts';
import { useCart } from '../../hooks/useCart';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ShoppingBag, Plus, Minus, ArrowLeft } from 'lucide-react';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug || '');
  const { addToCart, items, updateQuantity, removeFromCart } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  
  const cartItem = items.find(i => i.productId === product?.id);
  const cartQuantity = cartItem?.quantity || 0;

  if (isLoading) return <LoadingSpinner />;
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Product not found</h1>
          <Link to="/shop"><Button>Back to Shop</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--section-bg-light)' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to="/shop" className="inline-flex items-center mb-6" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Shop
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="rounded-lg overflow-hidden mb-3" style={{ backgroundColor: 'var(--card-bg)' }}>
            {product.images?.length > 0 ? (
              <img src={product.images[activeImage] || product.image_url || ''} alt={product.name} className="w-full h-96 object-cover" />
            ) : product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-96 object-cover" />
            ) : (
              <div className="w-full h-96 flex items-center justify-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                <ShoppingBag className="h-24 w-24" style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            </div>
            {(product.images?.length || (product.image_url ? 1 : 0)) > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {(product.images?.length ? product.images : [product.image_url]).filter(Boolean).map((src, idx) => (
                  <button key={idx} type="button" onClick={() => setActiveImage(idx)} className="rounded overflow-hidden border-2" style={{ borderColor: activeImage === idx ? 'var(--primary-color)' : 'var(--border-color)' }}>
                    <img src={src as string} alt={`${product.name} ${idx + 1}`} className="w-full h-20 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {product.category && (
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{product.category.name}</p>
            )}
            <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{product.name}</h1>
            
            <div className="flex items-center gap-4 mb-6">
              <span className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(product.price)}</span>
                {product.compare_at_price && (
                  <span className="text-lg line-through" style={{ color: 'var(--text-muted)' }}>{formatCurrency(product.compare_at_price)}</span>
              )}
            </div>

            {product.description && (
              <div className="mb-6 rounded-2xl p-5 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Description</h2>
                <div className="space-y-4" style={{ color: 'var(--text-secondary)' }}>
                  {product.description.split(/\n\n+/).map((block, index) => {
                    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
                    const bulletLines = lines.filter(line => line.startsWith('- '));

                    if (bulletLines.length > 0) {
                      return (
                        <ul key={index} className="list-disc pl-5 space-y-1">
                          {bulletLines.map((line, bulletIndex) => (
                            <li key={bulletIndex}>{line.replace(/^-\s*/, '')}</li>
                          ))}
                        </ul>
                      );
                    }

                    return (
                      <p key={index} className="leading-7 whitespace-pre-line">
                        {block}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Best For</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{product.stock > 20 ? 'Gifting and events' : 'Limited edition shoppers'}</p>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Style</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{product.category?.name || 'Studio favorite'}</p>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Shipping</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Packed with care</p>
              </div>
            </div>

            {product.stock !== undefined && (
              <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </p>
            )}

            <div className="flex items-center gap-4">
              {cartQuantity > 0 ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => updateQuantity(product.id, cartQuantity - 1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="px-4" style={{ color: 'var(--text-primary)' }}>{cartQuantity}</span>
                   <Button variant="secondary" onClick={() => addToCart(product.id, product.name, product.price, product.image_url ?? undefined)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" onClick={() => removeFromCart(product.id)}>Remove</Button>
                </div>
              ) : (
                 <Button onClick={() => addToCart(product.id, product.name, product.price, product.image_url ?? undefined)} disabled={product.stock === 0}>
                  Add to Cart
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
