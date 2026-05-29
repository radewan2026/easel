import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts, useProductCategories } from '../../hooks/useProducts';
import { useCart } from '../../hooks/useCart';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ShoppingBag, Plus } from 'lucide-react';

export default function ShopPage() {
  const { data: products, isLoading } = useProducts({ active: true });
  const { data: categories } = useProductCategories();
  const { addToCart } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name'>('featured');

  const filteredProducts = products
    ?.filter(p => {
    if (selectedCategory === 'all') return true;
    return p.category_id === selectedCategory;
  })
    ?.filter(p => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    })
    ?.sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--section-bg-light)' }}>
      <div className="relative h-64 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))' }}>
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-2">Shop</h1>
          <p className="text-lg opacity-90">Browse our collection of art supplies and merchandise</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <aside className="rounded-2xl p-5 h-fit sticky top-24" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Filters</h2>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products"
              className="w-full px-4 py-2 mb-4 border rounded-lg"
              style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <div className="space-y-3 mb-5">
              <label className="block text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full px-4 py-2 border rounded-lg"
                style={{ backgroundColor: 'var(--admin-input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="space-y-2">
              <button
            onClick={() => setSelectedCategory('all')}
            className="w-full px-4 py-2 rounded-lg text-left transition-colors"
            style={{
              backgroundColor: selectedCategory === 'all' ? 'var(--primary-color)' : 'var(--card-bg)',
              color: selectedCategory === 'all' ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }}
          >
            All Products
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="w-full px-4 py-2 rounded-lg text-left transition-colors"
              style={{
                backgroundColor: selectedCategory === cat.id ? 'var(--primary-color)' : 'var(--card-bg)',
                color: selectedCategory === cat.id ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              {cat.name}
            </button>
          ))}
            </div>
          </aside>

          <section>
            <div className="flex items-center justify-between mb-4">
              <p style={{ color: 'var(--text-muted)' }}>{filteredProducts?.length || 0} products</p>
              <Link to="/cart"><Button variant="secondary">View Cart</Button></Link>
            </div>

            {filteredProducts?.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <ShoppingBag className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No products found</h2>
                <p style={{ color: 'var(--text-muted)' }}>Try another category or search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts?.map((product) => (
                  <div key={product.id} className="rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                    <Link to={`/shop/${product.slug}`}>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-56 object-cover" />
                      ) : (
                        <div className="w-full h-56 flex items-center justify-center" style={{ backgroundColor: 'var(--section-bg-light)' }}>
                          <ShoppingBag className="h-12 w-12" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      )}
                    </Link>
                    <div className="p-5">
                      {product.category && (
                        <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{product.category.name}</p>
                      )}
                      <Link to={`/shop/${product.slug}`}>
                        <h3 className="font-semibold mb-2 hover:underline" style={{ color: 'var(--text-primary)' }}>{product.name}</h3>
                      </Link>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-bold" style={{ color: 'var(--primary-color)' }}>{formatCurrency(product.price)}</span>
                        {product.compare_at_price && (
                          <span className="text-sm line-through" style={{ color: 'var(--text-muted)' }}>{formatCurrency(product.compare_at_price)}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Link className="flex-1" to={`/shop/${product.slug}`}>
                          <Button variant="secondary" className="w-full">View Details</Button>
                        </Link>
                        <Button 
                          onClick={() => addToCart(product.id, product.name, product.price, product.image_url ?? undefined)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
