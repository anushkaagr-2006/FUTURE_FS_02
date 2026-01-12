import React, { useState, useEffect, createContext, useContext } from 'react';
import { ShoppingCart, User, Search, Plus, Minus, Trash2, LogOut, Package, Check, X, Edit, Menu, ArrowLeft, Heart, Shield, Truck, RotateCcw, Star } from 'lucide-react';

// Context
const StoreContext = createContext();
const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};

// Utility: Convert USD to INR and format
const formatINR = (usdPrice) => {
  const inrPrice = usdPrice * 83;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(inrPrice);
};

const convertToINR = (usdPrice) => usdPrice * 83;

// Store Provider
const StoreProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCarts, setUserCarts] = useState(() => {
    const saved = localStorage.getItem('userCarts');
    return saved ? JSON.parse(saved) : {};
  });
  const [userOrders, setUserOrders] = useState(() => {
    const saved = localStorage.getItem('userOrders');
    return saved ? JSON.parse(saved) : {};
  });
  const [productReviews, setProductReviews] = useState(() => {
    const saved = localStorage.getItem('productReviews');
    return saved ? JSON.parse(saved) : {};
  }); // { productId: [reviews] }

  // Save carts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('userCarts', JSON.stringify(userCarts));
  }, [userCarts]);

  // Save orders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('userOrders', JSON.stringify(userOrders));
  }, [userOrders]);

  // Save reviews to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('productReviews', JSON.stringify(productReviews));
  }, [productReviews]);

  // Save products to localStorage whenever they change
  useEffect(() => {
    if (products.length > 0) {
      localStorage.setItem('products', JSON.stringify(products));
    }
  }, [products]);

  // Load user from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      // First, load any locally saved products immediately
      const savedProducts = localStorage.getItem('products');
      const localProducts = savedProducts ? JSON.parse(savedProducts) : [];
      
      if (localProducts.length > 0) {
        setProducts(localProducts);
        setLoading(false);
      }

      try {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${API_URL}/products`);
        
        if (!response.ok) throw new Error('Backend not available');
        
        const backendProducts = await response.json();
        
        // Get locally added products (those with 'id' instead of '_id')
        const locallyAddedProducts = localProducts.filter(p => p.id && !p._id);
        
        // Merge: backend products + locally added products (avoid duplicates)
        const mergedProducts = [
          ...backendProducts,
          ...locallyAddedProducts.filter(
            local => !backendProducts.some(backend => backend._id === local.id || backend.id === local.id)
          )
        ];
        
        setProducts(mergedProducts);
        localStorage.setItem('products', JSON.stringify(mergedProducts));
      } catch (error) {
        console.log('Backend not available, using localStorage or FakeStore API');
        
        if (localProducts.length > 0) {
          // Already set above, just keep using local products
          return;
        }
        
        // Fallback to FakeStore API
        try {
          const response = await fetch('https://fakestoreapi.com/products');
          const data = await response.json();
          setProducts(data);
          localStorage.setItem('products', JSON.stringify(data));
        } catch (fallbackError) {
          console.error('All APIs failed:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (user?.email) {
      setCart(userCarts[user.email] || []);
    } else {
      setCart([]);
    }
  }, [user?.email, userCarts]);

  useEffect(() => {
    if (user?.email) {
      setOrders(userOrders[user.email] || []);
    } else {
      setOrders([]);
    }
  }, [user, userOrders]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => (item._id || item.id) === (product._id || product.id));
      const newCart = existing
        ? prev.map(item => (item._id || item.id) === (product._id || product.id) ? { ...item, quantity: item.quantity + 1 } : item)
        : [...prev, { ...product, quantity: 1 }];
      if (user?.email) {
        setUserCarts(prevCarts => ({ ...prevCarts, [user.email]: newCart }));
      }
      return newCart;
    });
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => {
      const newCart = prev.map(item => (item._id || item.id) === productId ? { ...item, quantity } : item);
      if (user?.email) {
        setUserCarts(prevCarts => ({ ...prevCarts, [user.email]: newCart }));
      }
      return newCart;
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => {
      const newCart = prev.filter(item => (item._id || item.id) !== productId);
      if (user?.email) {
        setUserCarts(prevCarts => ({ ...prevCarts, [user.email]: newCart }));
      }
      return newCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    if (user?.email) {
      setUserCarts(prevCarts => ({ ...prevCarts, [user.email]: [] }));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (convertToINR(item.price) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const createOrder = (orderData) => {
    if (!user) {
      alert('Please login to place order');
      return null;
    }
    const order = {
      id: Date.now(),
      items: [...cart],
      total: cartTotal,
      ...orderData,
      date: new Date().toISOString(),
      status: 'confirmed',
      userId: user.email
    };
    setUserOrders(prev => ({
      ...prev,
      [user.email]: [order, ...(prev[user.email] || [])]
    }));
    clearCart();
    return order;
  };

  const addProduct = async (product) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ ...product, rating: { rate: 0, count: 0 } })
      });
      
      if (!response.ok) throw new Error('Backend not available');
      
      const newProduct = await response.json();
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (error) {
      console.log('Backend not available, adding product locally');
      // Fallback: Add product locally
      const newProduct = {
        ...product,
        id: Date.now(),
        rating: { rate: 0, count: 0 }
      };
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    }
  };

  const updateProduct = async (productId, updates) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error('Backend not available');
      
      const updatedProduct = await response.json();
      setProducts(prev => prev.map(p => (p._id === productId || p.id === productId) ? updatedProduct : p));
      return updatedProduct;
    } catch (error) {
      console.log('Backend not available, updating product locally');
      // Fallback: Update product locally
      setProducts(prev => prev.map(p => (p._id === productId || p.id === productId) ? { ...p, ...updates } : p));
    }
  };

  const deleteProduct = async (productId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      
      if (!response.ok) throw new Error('Backend not available');
      
      setProducts(prev => prev.filter(p => p._id !== productId && p.id !== productId));
    } catch (error) {
      console.log('Backend not available, deleting product locally');
      // Fallback: Delete product locally
      setProducts(prev => prev.filter(p => p._id !== productId && p.id !== productId));
    }
  };

  const addReview = (productId, review) => {
    if (!user) {
      alert('Please login to leave a review');
      return;
    }

    const newReview = {
      id: Date.now(),
      userId: user.email,
      userName: user.name,
      rating: review.rating,
      comment: review.comment,
      date: new Date().toISOString()
    };

    // Add review to product reviews
    setProductReviews(prev => ({
      ...prev,
      [productId]: [...(prev[productId] || []), newReview]
    }));

    // Update product rating
    const reviews = [...(productReviews[productId] || []), newReview];
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    setProducts(prev => prev.map(p => {
      if ((p._id || p.id) === productId) {
        return {
          ...p,
          rating: {
            rate: Number(avgRating.toFixed(1)),
            count: reviews.length
          }
        };
      }
      return p;
    }));
  };

  const getProductReviews = (productId) => {
    return productReviews[productId] || [];
  };

  return (
    <StoreContext.Provider value={{
      products, cart, user, orders, loading,
      addToCart, updateQuantity, removeFromCart, clearCart,
      cartTotal, cartCount, setUser, createOrder,
      addProduct, updateProduct, deleteProduct,
      addReview, getProductReviews
    }}>
      {children}
    </StoreContext.Provider>
  );
};

// Navigation
const Navigation = ({ currentView, setCurrentView, setShowCart }) => {
  const { user, setUser, cartCount } = useStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = () => {
    // Clear user from localStorage
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView('products');
    setShowMenu(false);
  };

  return (
    <nav className="nav-container">
      <div className="nav-content">
        <button className="mobile-menu-btn" onClick={() => setShowMobileMenu(!showMobileMenu)}>
          <Menu size={24} />
        </button>
        
        <button onClick={() => setCurrentView('products')} className="brand-logo">
          ATELIER
        </button>

        <div className={`nav-links ${showMobileMenu ? 'show' : ''}`}>
          <button onClick={() => { setCurrentView('products'); setShowMobileMenu(false); }}>Home</button>
          <button onClick={() => { setCurrentView('products'); setShowMobileMenu(false); }}>Products</button>
        </div>

        <div className="nav-actions">
          <button onClick={() => setShowCart(true)} className="nav-button cart-button">
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>

          {user ? (
            <div className="user-menu">
              <button onClick={() => setShowMenu(!showMenu)} className="nav-button">
                <User size={20} />
              </button>
              {showMenu && (
                <div className="dropdown-menu">
                  <div className="user-info">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button onClick={() => { setCurrentView('orders'); setShowMenu(false); }}>
                    <Package size={16} /> My Orders
                  </button>
                  {user.role === 'admin' && (
                    <button onClick={() => { setCurrentView('admin'); setShowMenu(false); }}>
                      <Edit size={16} /> Admin Panel
                    </button>
                  )}
                  <button onClick={handleLogout} className="logout-btn">
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setCurrentView('auth')} className="nav-button login-btn">
              <User size={20} />
              <span className="btn-text">Login</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

// Product Card
const ProductCard = ({ product, onAddToCart, onViewDetails }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="product-card">
      <div className="product-image-container" onClick={() => onViewDetails(product._id || product.id)}>
        {!imageLoaded && !imageError && <div className="image-skeleton"></div>}
        {imageError ? (
          <div className="image-placeholder">
            <span>Image not available</span>
          </div>
        ) : (
          <img 
            src={product.image} 
            alt={product.title}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        )}
      </div>
      <div className="product-info">
        <div className="product-category">{product.category}</div>
        <h3 className="product-title" onClick={() => onViewDetails(product._id || product.id)}>{product.title}</h3>
        {product.rating && product.rating.count > 0 && (
          <div className="product-rating-small">
            <Star size={14} fill="#fbbf24" color="#fbbf24" />
            <span>{product.rating.rate}</span>
            <span className="rating-count">({product.rating.count})</span>
          </div>
        )}
        <div className="product-footer">
          <span className="product-price">{formatINR(product.price)}</span>
          <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }} className="add-to-cart-btn">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

// Product Detail View
const ProductDetailView = ({ productId, onBack }) => {
  const { products, addToCart, user, addReview, getProductReviews } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const product = products.find(p => (p._id || p.id) === productId);
  const reviews = getProductReviews(productId);

  if (!product) {
    return (
      <div className="product-detail-container">
        <button onClick={onBack} className="back-button"><ArrowLeft size={20} /> Back</button>
        <div className="empty-state"><p>Product not found</p></div>
      </div>
    );
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please login to leave a review');
      return;
    }
    addReview(productId, { rating: reviewRating, comment: reviewComment });
    setReviewComment('');
    setReviewRating(5);
    setShowReviewForm(false);
    alert('✅ Thank you for your review!');
  };

  return (
    <div className="product-detail-container">
      <button onClick={onBack} className="back-button"><ArrowLeft size={20} /> Back to Products</button>
      <div className="product-detail-content">
        <div className="product-detail-image">
          <img src={product.image} alt={product.title} />
        </div>
        <div className="product-detail-info">
          <div className="product-detail-category">{product.category}</div>
          <h1 className="product-detail-title">{product.title}</h1>
          {product.rating && product.rating.count > 0 && (
            <div className="product-rating">
              <div className="rating-stars">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={20} fill={i < Math.round(product.rating.rate) ? "#fbbf24" : "none"} color="#fbbf24" />
                ))}
              </div>
              <span className="rating-text">{product.rating.rate} ({product.rating.count} reviews)</span>
            </div>
          )}
          {(!product.rating || product.rating.count === 0) && (
            <div className="product-rating">
              <span className="rating-text new-product">New Product - Be the first to review!</span>
            </div>
          )}
          <div className="product-detail-price">{formatINR(product.price)}</div>
          <div className="product-description">
            <h3>Description</h3>
            <p>{product.description}</p>
          </div>
          <div className="product-features">
            <h3>Features</h3>
            <ul>
              <li><Shield size={16} /> Secure Payment</li>
              <li><Truck size={16} /> Free Delivery</li>
              <li><RotateCcw size={16} /> 7 Days Return Policy</li>
              <li><Check size={16} /> 100% Authentic Products</li>
            </ul>
          </div>
          <div className="product-actions">
            <div className="quantity-selector">
              <label>Quantity:</label>
              <div className="quantity-controls">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                  <Minus size={16} />
                </button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <button onClick={handleAddToCart} className="add-to-cart-btn-large" disabled={addedToCart}>
              {addedToCart ? <><Check size={20} /> Added!</> : <><ShoppingCart size={20} /> Add to Cart</>}
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="reviews-section">
        <div className="reviews-header">
          <h2>Customer Reviews</h2>
          {user && (
            <button onClick={() => setShowReviewForm(!showReviewForm)} className="primary-btn">
              {showReviewForm ? 'Cancel' : 'Write a Review'}
            </button>
          )}
          {!user && (
            <p className="login-prompt">Please login to write a review</p>
          )}
        </div>

        {showReviewForm && (
          <form onSubmit={handleReviewSubmit} className="review-form">
            <div className="form-group">
              <label>Your Rating</label>
              <div className="star-rating-input">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={32}
                    fill={star <= reviewRating ? "#fbbf24" : "none"}
                    color="#fbbf24"
                    onClick={() => setReviewRating(star)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Your Review</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your thoughts about this product..."
                rows="4"
                required
              />
            </div>
            <button type="submit" className="primary-btn">Submit Review</button>
          </form>
        )}

        <div className="reviews-list">
          {reviews.length === 0 ? (
            <div className="no-reviews">
              <p>No reviews yet. Be the first to review this product!</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <div>
                    <strong>{review.userName}</strong>
                    <div className="review-stars">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={16} fill={i < review.rating ? "#fbbf24" : "none"} color="#fbbf24" />
                      ))}
                    </div>
                  </div>
                  <span className="review-date">
                    {new Date(review.date).toLocaleDateString('en-IN', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                <p className="review-comment">{review.comment}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Products View
const ProductsView = () => {
  const { products, loading, addToCart } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [selectedProductId, setSelectedProductId] = useState(null);

  const categories = ['all', ...new Set(products.map(p => p.category))];

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      return 0;
    });

  if (selectedProductId) {
    return <ProductDetailView productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className="products-view">
      <div className="hero-section">
        <h1 className="hero-title">Discover Premium Products</h1>
        <p className="hero-subtitle">Curated collection of finest quality items at the best prices</p>
      </div>

      <div className="filters-section">
        <div className="search-container">
          <Search size={20} className="search-icon" />
          <input type="text" placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </div>
        <div className="filter-controls">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="filter-select">
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
            <option value="default">Sort By</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.map(product => (
          <ProductCard key={product._id || product.id} product={product} onAddToCart={addToCart} onViewDetails={setSelectedProductId} />
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="empty-state"><p>No products found</p></div>
      )}
    </div>
  );
};

// Shopping Cart
const ShoppingCartPanel = ({ isOpen, onClose }) => {
  const { cart, updateQuantity, removeFromCart, cartTotal } = useStore();
  const [showCheckout, setShowCheckout] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="cart-overlay" onClick={onClose}></div>
      <div className={`cart-panel ${isOpen ? 'open' : ''}`}>
        <div className="cart-header">
          <h2>Shopping Cart</h2>
          <button onClick={onClose} className="close-btn"><X size={24} /></button>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <ShoppingCart size={48} />
              <p>Your cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item._id || item.id} className="cart-item">
                <img src={item.image} alt={item.title} />
                <div className="cart-item-details">
                  <h4>{item.title}</h4>
                  <p className="cart-item-price">{formatINR(item.price)}</p>
                  <div className="quantity-controls">
                    <button onClick={() => updateQuantity(item._id || item.id, item.quantity - 1)}><Minus size={16} /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item._id || item.id, item.quantity + 1)}><Plus size={16} /></button>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item._id || item.id)} className="remove-btn"><Trash2 size={18} /></button>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total:</span>
              <span className="total-amount">₹{Math.round(cartTotal).toLocaleString('en-IN')}</span>
            </div>
            <button onClick={() => setShowCheckout(true)} className="checkout-btn">Proceed to Checkout</button>
          </div>
        )}
      </div>
      {showCheckout && <CheckoutModal onClose={() => setShowCheckout(false)} />}
    </>
  );
};

// Checkout Modal
const CheckoutModal = ({ onClose }) => {
  const { cartTotal, createOrder, cart } = useStore();
  const [formData, setFormData] = useState({ fullName: '', email: '', address: '', city: '', zipCode: '', phone: '' });
  const [orderComplete, setOrderComplete] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Name required';
    if (!formData.email.match(/^\S+@\S+\.\S+$/)) newErrors.email = 'Valid email required';
    if (!formData.address.trim()) newErrors.address = 'Address required';
    if (!formData.city.trim()) newErrors.city = 'City required';
    if (!formData.zipCode.match(/^\d{6}$/)) newErrors.zipCode = '6-digit PIN code required';
    if (!formData.phone.match(/^\d{10}$/)) newErrors.phone = '10-digit phone required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setTimeout(() => {
      createOrder(formData);
      setOrderComplete(true);
    }, 1500);
  };

  if (orderComplete) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content success-modal" onClick={e => e.stopPropagation()}>
          <div className="success-icon"><Check size={48} /></div>
          <h2>Order Confirmed!</h2>
          <p>Your order has been placed successfully</p>
          <p className="order-number">Order #{Date.now()}</p>
          <button onClick={onClose} className="primary-btn">Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content checkout-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Checkout</h2>
          <button onClick={onClose} className="close-btn"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="checkout-form">
          <div className="form-section">
            <h3>Delivery Information</h3>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={formData.fullName} onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))} className={errors.fullName ? 'error' : ''} />
              {errors.fullName && <span className="error-text">{errors.fullName}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className={errors.email ? 'error' : ''} />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="10-digit mobile number" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} className={errors.phone ? 'error' : ''} maxLength="10" />
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} className={errors.address ? 'error' : ''} />
              {errors.address && <span className="error-text">{errors.address}</span>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input type="text" value={formData.city} onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))} className={errors.city ? 'error' : ''} />
                {errors.city && <span className="error-text">{errors.city}</span>}
              </div>
              <div className="form-group">
                <label>PIN Code</label>
                <input type="text" placeholder="6 digits" value={formData.zipCode} onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))} maxLength="6" className={errors.zipCode ? 'error' : ''} />
                {errors.zipCode && <span className="error-text">{errors.zipCode}</span>}
              </div>
            </div>
          </div>
          <div className="order-summary">
            <div className="summary-row"><span>Subtotal:</span><span>₹{Math.round(cartTotal).toLocaleString('en-IN')}</span></div>
            <div className="summary-row"><span>Delivery:</span><span>FREE</span></div>
            <div className="summary-row total-row"><span>Total:</span><span>₹{Math.round(cartTotal).toLocaleString('en-IN')}</span></div>
          </div>
          <button type="submit" className="primary-btn full-width">Place Order (Cash on Delivery)</button>
        </form>
      </div>
    </div>
  );
};

// Auth View
const AuthView = () => {
  const { setUser } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const ADMIN_EMAIL = 'admin@store.com';
    const ADMIN_PASSWORD = 'admin@123';

    if (formData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      if (isLogin) {
        if (formData.password !== ADMIN_PASSWORD) {
          alert('❌ Invalid admin credentials!');
          return;
        }
      } else {
        alert('❌ This email is reserved for admin');
        return;
      }
    }

    const userData = {
      id: Date.now(),
      email: formData.email,
      name: formData.name || formData.email.split('@')[0],
      role: formData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user'
    };

    // Save user to localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    
    setUser(userData);
    setSuccessMessage(userData.role === 'admin' ? '👑 Admin access granted!' : '✅ Successfully signed in!');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
  };

  return (
    <div className="auth-container">
      {showSuccess && (
        <div className="success-popup">
          <div className="success-content">
            <Check size={48} className="success-icon" />
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <div className="admin-credentials-box">
        <h4>🔐 Admin Credentials</h4>
        <p><strong>Email:</strong> admin@store.com</p>
        <p><strong>Password:</strong> admin@123</p>
      </div>

      <div className="auth-card">
        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} required={!isLogin} />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} required />
          </div>
          <button type="submit" className="primary-btn full-width">{isLogin ? 'Sign In' : 'Sign Up'}</button>
        </form>
        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="link-btn">{isLogin ? 'Sign Up' : 'Sign In'}</button>
        </p>
      </div>
    </div>
  );
};

// Orders View
const OrdersView = () => {
  const { orders } = useStore();

  return (
    <div className="orders-view">
      <h1>My Orders</h1>
      {orders.length === 0 ? (
        <div className="empty-state">
          <Package size={48} />
          <p>No orders yet</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div>
                  <h3>Order #{order.id}</h3>
                  <p className="order-date">{new Date(order.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <span className="order-status">{order.status}</span>
              </div>
              <div className="order-items">
                {order.items.map(item => (
                  <div key={item._id || item.id} className="order-item">
                    <img src={item.image} alt={item.title} />
                    <div>
                      <p>{item.title}</p>
                      <p className="item-quantity">Qty: {item.quantity}</p>
                    </div>
                    <p className="item-price">{formatINR(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="order-total">
                <span>Total:</span>
                <span>₹{Math.round(order.total).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin View
const AdminView = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ title: '', price: '', description: '', category: '', image: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const productData = { ...formData, price: parseFloat(formData.price) };
    try {
      if (editingProduct) {
        await updateProduct(editingProduct._id || editingProduct.id, productData);
        alert('✅ Product updated successfully!');
      } else {
        await addProduct(productData);
        alert('✅ Product added successfully! Price will show in INR: ' + formatINR(parseFloat(formData.price)));
      }
      resetForm();
    } catch (error) {
      console.error('Product operation error:', error);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', price: '', description: '', category: '', image: '' });
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({ title: product.title, price: product.price.toString(), description: product.description, category: product.category, image: product.image });
    setShowForm(true);
  };

  return (
    <div className="admin-view">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <button onClick={() => setShowForm(true)} className="primary-btn"><Plus size={20} /> Add Product</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={resetForm} className="close-btn"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Price (USD - will be converted to INR)</label>
                <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input type="text" value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input type="url" value={formData.image} onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows="4" required />
              </div>
              <button type="submit" className="primary-btn full-width">{editingProduct ? 'Update' : 'Add'} Product</button>
            </form>
          </div>
        </div>
      )}

      <div className="admin-products">
        {products.map(product => (
          <div key={product._id || product.id} className="admin-product-card">
            <img src={product.image} alt={product.title} />
            <div className="admin-product-info">
              <h3>{product.title}</h3>
              <p className="admin-product-category">{product.category}</p>
              <p className="admin-product-price">{formatINR(product.price)}</p>
            </div>
            <div className="admin-product-actions">
              <button onClick={() => handleEdit(product)} className="edit-btn"><Edit size={18} /></button>
              <button onClick={() => deleteProduct(product._id || product.id)} className="delete-btn"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main App
const ECommerceStore = () => {
  const [currentView, setCurrentView] = useState('products');
  const [showCart, setShowCart] = useState(false);

  return (
    <StoreProvider>
      <AppContent currentView={currentView} setCurrentView={setCurrentView} showCart={showCart} setShowCart={setShowCart} />
    </StoreProvider>
  );
};

const AppContent = ({ currentView, setCurrentView, showCart, setShowCart }) => {
  const { user } = useStore();

  useEffect(() => {
    if (user && currentView === 'auth') {
      setCurrentView('products');
    }
  }, [user, currentView, setCurrentView]);

  return (
    <div className="app">
      <Navigation currentView={currentView} setCurrentView={setCurrentView} setShowCart={setShowCart} />
      <main className="main-content">
        {currentView === 'products' && <ProductsView />}
        {currentView === 'auth' && <AuthView />}
        {currentView === 'orders' && <OrdersView />}
        {currentView === 'admin' && <AdminView />}
      </main>
      <ShoppingCartPanel isOpen={showCart} onClose={() => setShowCart(false)} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Work+Sans:wght@300;400;500;600&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
          --primary: #1a1a1a;
          --secondary: #8b7355;
          --accent: #c9a887;
          --background: #faf8f5;
          --surface: #ffffff;
          --text: #2c2c2c;
          --text-light: #6b6b6b;
          --border: #e8e4df;
          --success: #4a7c59;
          --error: #c4574a;
          --shadow: rgba(0, 0, 0, 0.08);
        }
        
        body {
          font-family: 'Work Sans', sans-serif;
          background: var(--background);
          color: var(--text);
          line-height: 1.6;
        }
        
        .app { min-height: 100vh; display: flex; flex-direction: column; }
        
        /* Navigation */
        .nav-container {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.95);
        }
        
        .nav-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
        }
        
        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          color: var(--primary);
        }
        
        .brand-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          font-weight: 600;
          letter-spacing: 0.15em;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--primary);
          transition: opacity 0.3s;
        }
        
        .brand-logo:hover {
          opacity: 0.7;
        }
        
        .nav-links {
          display: flex;
          gap: 2rem;
        }
        
        .nav-links button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          color: var(--text);
          transition: color 0.3s;
        }
        
        .nav-links button:hover {
          color: var(--secondary);
        }
        
        .nav-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        
        .nav-button {
          background: none;
          border: 1px solid var(--border);
          padding: 0.625rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s;
          position: relative;
        }
        
        .nav-button:hover {
          background: var(--surface);
          border-color: var(--secondary);
        }
        
        .login-btn .btn-text {
          font-weight: 500;
        }
        
        .cart-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: var(--secondary);
          color: white;
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-weight: 600;
        }
        
        .user-menu { position: relative; }
        
        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 4px 12px var(--shadow);
          min-width: 220px;
          overflow: hidden;
          animation: fadeIn 0.2s;
        }
        
        .user-info {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .user-info strong {
          font-weight: 600;
          color: var(--primary);
        }
        
        .user-info span {
          font-size: 0.875rem;
          color: var(--text-light);
        }
        
        .dropdown-menu button {
          width: 100%;
          padding: 0.875rem 1rem;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: background 0.2s;
          font-size: 0.95rem;
        }
        
        .dropdown-menu button:hover {
          background: var(--surface);
        }
        
        .logout-btn {
          color: var(--error);
        }
        
        /* Main Content */
        .main-content {
          flex: 1;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          padding: 2rem;
        }
        
        /* Hero */
        .hero-section {
          text-align: center;
          padding: 4rem 2rem;
          margin-bottom: 3rem;
        }
        
        .hero-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 4rem;
          font-weight: 400;
          margin-bottom: 1rem;
          color: var(--primary);
          letter-spacing: 0.02em;
        }
        
        .hero-subtitle {
          font-size: 1.125rem;
          color: var(--text-light);
          font-weight: 300;
        }
        
        /* Filters */
        .filters-section {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }
        
        .search-container {
          flex: 1;
          position: relative;
          min-width: 250px;
        }
        
        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-light);
        }
        
        .search-input {
          width: 100%;
          padding: 0.875rem 1rem 0.875rem 2.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 1rem;
          background: var(--background);
        }
        
        .search-input:focus {
          outline: none;
          border-color: var(--secondary);
        }
        
        .filter-controls {
          display: flex;
          gap: 1rem;
        }
        
        .filter-select {
          padding: 0.875rem 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 1rem;
          background: var(--background);
          cursor: pointer;
        }
        
        .filter-select:focus {
          outline: none;
          border-color: var(--secondary);
        }
        
        /* Products Grid */
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 2rem;
          margin-bottom: 4rem;
        }
        
        .product-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s;
          animation: fadeInUp 0.6s ease-out;
        }
        
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px var(--shadow);
        }
        
        .product-image-container {
          position: relative;
          width: 100%;
          height: 300px;
          background: var(--background);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .product-image-container img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 1.5rem;
          transition: transform 0.5s;
        }
        
        .product-card:hover .product-image-container img {
          transform: scale(1.05);
        }
        
        .image-skeleton {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }
        
        .image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface);
          color: var(--text-light);
          font-size: 0.875rem;
          text-align: center;
          padding: 2rem;
        }
        
        .product-info {
          padding: 1.25rem;
        }
        
        .product-category {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--secondary);
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .product-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem;
          font-weight: 500;
          margin-bottom: 1rem;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .product-rating-small {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-size: 0.875rem;
        }
        
        .product-rating-small span:first-child {
          font-weight: 600;
        }
        
        .rating-count {
          color: var(--text-light);
        }
        
        .product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        
        .product-price {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }
        
        .add-to-cart-btn {
          padding: 0.625rem 1.25rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .add-to-cart-btn:hover {
          background: var(--secondary);
          transform: translateY(-2px);
        }
        
        /* Product Detail */
        .product-detail-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .back-button {
          background: none;
          border: 1px solid var(--border);
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 2rem;
          font-size: 1rem;
          transition: all 0.3s;
        }
        
        .back-button:hover {
          background: var(--surface);
          border-color: var(--secondary);
        }
        
        .product-detail-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
        }
        
        .product-detail-image {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          position: sticky;
          top: 120px;
          height: fit-content;
          min-height: 400px;
        }
        
        .product-detail-image img {
          width: 100%;
          max-width: 500px;
          max-height: 500px;
          height: auto;
          object-fit: contain;
        }
        
        .product-detail-info {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .product-detail-category {
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--secondary);
          font-weight: 600;
        }
        
        .product-detail-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.5rem;
          font-weight: 500;
          line-height: 1.2;
          color: var(--primary);
        }
        
        .product-rating {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .rating-stars {
          display: flex;
          gap: 0.25rem;
        }
        
        .rating-text {
          color: var(--text-light);
          font-size: 0.95rem;
        }
        
        .rating-text.new-product {
          color: var(--secondary);
          font-weight: 600;
          font-style: italic;
        }
        
        .product-detail-price {
          font-size: 3rem;
          font-weight: 700;
          color: var(--secondary);
        }
        
        .product-description,
        .product-features {
          padding: 1.5rem 0;
          border-top: 1px solid var(--border);
        }
        
        .product-description h3,
        .product-features h3 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }
        
        .product-description p {
          line-height: 1.8;
          color: var(--text);
        }
        
        .product-features ul {
          list-style: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .product-features li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--text);
          font-size: 1rem;
        }
        
        .product-actions {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem 0;
          border-top: 1px solid var(--border);
        }
        
        .quantity-selector {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .quantity-selector label {
          font-weight: 600;
          font-size: 1rem;
        }
        
        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .quantity-controls button {
          width: 36px;
          height: 36px;
          border: 1px solid var(--border);
          background: white;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .quantity-controls button:hover:not(:disabled) {
          background: var(--surface);
          border-color: var(--secondary);
        }
        
        .quantity-controls button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .quantity-controls span {
          min-width: 36px;
          text-align: center;
          font-weight: 600;
          font-size: 1.125rem;
        }
        
        .add-to-cart-btn-large {
          padding: 1.25rem 2rem;
          background: var(--secondary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.125rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.3s;
        }
        
        .add-to-cart-btn-large:hover:not(:disabled) {
          background: var(--accent);
          transform: translateY(-2px);
        }
        
        .add-to-cart-btn-large:disabled {
          background: var(--success);
          cursor: not-allowed;
        }
        
        /* Cart Panel */
        .cart-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 200;
          animation: fadeIn 0.3s;
        }
        
        .cart-panel {
          position: fixed;
          top: 0;
          right: -100%;
          width: 100%;
          max-width: 450px;
          height: 100vh;
          background: var(--background);
          z-index: 201;
          display: flex;
          flex-direction: column;
          transition: right 0.3s;
          box-shadow: -4px 0 24px var(--shadow);
        }
        
        .cart-panel.open {
          right: 0;
        }
        
        .cart-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .cart-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
        }
        
        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
        }
        
        .cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }
        
        .empty-cart {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: var(--text-light);
        }
        
        .cart-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: var(--surface);
          border-radius: 12px;
          margin-bottom: 1rem;
        }
        
        .cart-item img {
          width: 80px;
          height: 80px;
          object-fit: contain;
          border-radius: 8px;
          background: var(--surface);
          padding: 0.5rem;
        }
        
        .cart-item-details {
          flex: 1;
        }
        
        .cart-item-details h4 {
          font-size: 0.95rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .cart-item-price {
          color: var(--secondary);
          font-weight: 700;
          margin-bottom: 0.75rem;
          font-size: 1.125rem;
        }
        
        .remove-btn {
          background: none;
          border: none;
          color: var(--error);
          cursor: pointer;
          padding: 0.5rem;
        }
        
        .cart-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--border);
        }
        
        .cart-total {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          font-size: 1.125rem;
        }
        
        .total-amount {
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary);
        }
        
        .checkout-btn {
          width: 100%;
          padding: 1rem;
          background: var(--secondary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .checkout-btn:hover {
          background: var(--accent);
        }
        
        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: fadeIn 0.3s;
        }
        
        .modal-content {
          background: var(--background);
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s;
        }
        
        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
        }
        
        /* Forms */
        .checkout-form,
        .product-form,
        .auth-form {
          padding: 1.5rem;
        }
        
        .form-section {
          margin-bottom: 1.5rem;
        }
        
        .form-section h3 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          font-size: 0.875rem;
          color: var(--text);
        }
        
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.875rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 1rem;
          font-family: inherit;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--secondary);
        }
        
        .form-group input.error {
          border-color: var(--error);
        }
        
        .error-text {
          color: var(--error);
          font-size: 0.875rem;
          margin-top: 0.25rem;
          display: block;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        
        .order-summary {
          background: var(--surface);
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          font-size: 1rem;
        }
        
        .total-row {
          font-size: 1.5rem;
          font-weight: 700;
          padding-top: 1rem;
          border-top: 2px solid var(--border);
          margin-top: 1rem;
        }
        
        .primary-btn {
          padding: 1rem 2rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .primary-btn:hover {
          background: var(--secondary);
          transform: translateY(-2px);
        }
        
        .primary-btn.full-width {
          width: 100%;
        }
        
        /* Success Modal */
        .success-modal {
          text-align: center;
          padding: 3rem 2rem;
        }
        
        .success-icon {
          width: 80px;
          height: 80px;
          background: var(--success);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }
        
        .success-modal h2 {
          font-size: 2rem;
          margin-bottom: 1rem;
        }
        
        .order-number {
          font-weight: 600;
          color: var(--secondary);
          margin: 1rem 0 2rem;
        }
        
        /* Auth */
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: 2rem;
          flex-wrap: wrap;
          padding: 2rem;
        }
        
        .admin-credentials-box {
          background: linear-gradient(135deg, #8b7355 0%, #c9a887 100%);
          color: white;
          padding: 2rem;
          border-radius: 16px;
          max-width: 350px;
          box-shadow: 0 8px 24px var(--shadow);
        }
        
        .admin-credentials-box h4 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .admin-credentials-box p {
          margin: 0.75rem 0;
          font-size: 1rem;
          line-height: 1.6;
        }
        
        .admin-credentials-box strong {
          font-weight: 600;
        }
        
        .auth-card {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2.5rem;
          max-width: 450px;
          width: 100%;
          box-shadow: 0 4px 16px var(--shadow);
        }
        
        .auth-card h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          margin-bottom: 2rem;
          text-align: center;
        }
        
        .auth-switch {
          text-align: center;
          margin-top: 1.5rem;
          color: var(--text-light);
        }
        
        .link-btn {
          background: none;
          border: none;
          color: var(--secondary);
          cursor: pointer;
          font-weight: 600;
          text-decoration: underline;
        }
        
        /* Success Popup */
        .success-popup {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s;
        }
        
        .success-content {
          background: white;
          padding: 3rem 4rem;
          border-radius: 16px;
          text-align: center;
          animation: slideUp 0.4s;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .success-content .success-icon {
          color: var(--success);
          margin-bottom: 1rem;
          animation: scaleIn 0.5s;
        }
        
        .success-content p {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--primary);
          margin: 0;
        }
        
        /* Orders */
        .orders-view h1,
        .admin-view h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 3rem;
          margin-bottom: 2rem;
        }
        
        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .order-card {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
        }
        
        .order-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }
        
        .order-header h3 {
          font-size: 1.125rem;
          margin-bottom: 0.25rem;
        }
        
        .order-date {
          color: var(--text-light);
          font-size: 0.875rem;
        }
        
        .order-status {
          background: var(--success);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
        }
        
        .order-items {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .order-item {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        
        .order-item img {
          width: 60px;
          height: 60px;
          object-fit: contain;
          border-radius: 6px;
          background: var(--surface);
          padding: 0.5rem;
        }
        
        .order-item > div {
          flex: 1;
        }
        
        .item-quantity {
          font-size: 0.875rem;
          color: var(--text-light);
        }
        
        .item-price {
          font-weight: 700;
          color: var(--primary);
        }
        
        .order-total {
          display: flex;
          justify-content: space-between;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
          font-size: 1.25rem;
          font-weight: 700;
        }
        
        /* Admin */
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .admin-products {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .admin-product-card {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          gap: 1rem;
          align-items: start;
        }
        
        .admin-product-card img {
          width: 80px;
          height: 80px;
          object-fit: contain;
          border-radius: 8px;
          background: var(--surface);
          padding: 0.5rem;
        }
        
        .admin-product-info {
          flex: 1;
        }
        
        .admin-product-info h3 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .admin-product-category {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--secondary);
          margin-bottom: 0.5rem;
        }
        
        .admin-product-price {
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--primary);
        }
        
        .admin-product-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .edit-btn,
        .delete-btn {
          padding: 0.5rem;
          border: 1px solid var(--border);
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .edit-btn:hover {
          background: var(--surface);
          border-color: var(--secondary);
        }
        
        .delete-btn:hover {
          background: var(--error);
          border-color: var(--error);
          color: white;
        }
        
        /* Loading */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: 1.5rem;
        }
        
        /* Reviews Section */
        .reviews-section {
          max-width: 1200px;
          margin: 3rem auto 0;
          padding: 2rem 0;
          border-top: 1px solid var(--border);
        }
        
        .reviews-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .reviews-header h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          font-weight: 500;
        }
        
        .login-prompt {
          color: var(--text-light);
          font-style: italic;
        }
        
        .review-form {
          background: var(--surface);
          padding: 2rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          border: 1px solid var(--border);
        }
        
        .star-rating-input {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        
        .reviews-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .no-reviews {
          text-align: center;
          padding: 3rem 2rem;
          background: var(--surface);
          border-radius: 12px;
          color: var(--text-light);
        }
        
        .review-card {
          background: var(--surface);
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        
        .review-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .review-header strong {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 1.05rem;
        }
        
        .review-stars {
          display: flex;
          gap: 0.25rem;
        }
        
        .review-date {
          color: var(--text-light);
          font-size: 0.875rem;
        }
        
        .review-comment {
          color: var(--text);
          line-height: 1.6;
        }
        
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--border);
          border-top-color: var(--secondary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: var(--text-light);
        }
        
        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
          .product-detail-content {
            grid-template-columns: 1fr;
          }
          
          .product-detail-image {
            position: static;
          }
        }
        
        @media (max-width: 768px) {
          .nav-content {
            padding: 1rem;
          }
          
          .mobile-menu-btn {
            display: block;
          }
          
          .nav-links {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--background);
            flex-direction: column;
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            display: none;
            box-shadow: 0 4px 8px var(--shadow);
          }
          
          .nav-links.show {
            display: flex;
          }
          
          .nav-links button {
            padding: 0.75rem;
            text-align: left;
          }
          
          .btn-text {
            display: none;
          }
          
          .brand-logo {
            font-size: 1.5rem;
          }
          
          .hero-title {
            font-size: 2rem;
          }
          
          .filters-section {
            flex-direction: column;
          }
          
          .filter-controls {
            width: 100%;
          }
          
          .filter-select {
            flex: 1;
          }
          
          .products-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .cart-panel {
            max-width: 100%;
          }
          
          .modal-content {
            margin: 0.5rem;
          }
          
          .admin-products {
            grid-template-columns: 1fr;
          }
          
          .product-detail-title {
            font-size: 2rem;
          }
          
          .product-detail-price {
            font-size: 2rem;
          }
          
          .auth-container {
            flex-direction: column;
          }
        }
        
        @media (max-width: 480px) {
          .main-content {
            padding: 1rem;
          }
          
          .hero-section {
            padding: 2rem 1rem;
          }
          
          .hero-title {
            font-size: 1.75rem;
          }
          
          .products-grid {
            grid-template-columns: 1fr;
          }
          
          .product-title {
            font-size: 0.95rem;
          }
          
          .product-price {
            font-size: 1.25rem;
          }
          
          .success-content {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ECommerceStore;