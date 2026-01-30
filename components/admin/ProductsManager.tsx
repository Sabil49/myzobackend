// components/admin/ProductsManager.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  styleCode: string;
  price: number;
  stock: number;
  isActive: boolean;
  images: string[];
  category?: { name: string };
  description?: string;
  categoryId?: string;
  materials?: string[];
  dimensions?: string;
  careInstructions?: string;
  isFeatured?: boolean;
}

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken'); // You'll need to implement admin auth
      const response = await fetch(`/api/admin/products?page=${page}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch products:', response.status, response.statusText);
        setError(`Failed to fetch products: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      setProducts(data.products);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (loading) {
    return <div className="p-8 text-center">Loading products...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-serif text-espresso-500">Products</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-espresso-500 text-cream-100 px-6 py-3 hover:bg-espresso-600 transition"
        >
          Add New Product
        </button>
      </div>

      <div className="bg-white border border-espresso-200">
        <table className="w-full">
          <thead className="border-b border-espresso-200">
            <tr>
              <th className="text-left p-4 font-medium text-espresso-700">Image</th>
              <th className="text-left p-4 font-medium text-espresso-700">Name</th>
              <th className="text-left p-4 font-medium text-espresso-700">Style Code</th>
              <th className="text-left p-4 font-medium text-espresso-700">Price</th>
              <th className="text-left p-4 font-medium text-espresso-700">Stock</th>
              <th className="text-left p-4 font-medium text-espresso-700">Status</th>
              <th className="text-left p-4 font-medium text-espresso-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-espresso-200 hover:bg-cream-100">
                <td className="p-4">
                  {product.images?.[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      width={64}
                      height={80}
                      className="object-cover bg-cream-300"
                    />
                  ) : (
                    <div className="w-16 h-20 bg-cream-300 flex items-center justify-center text-espresso-400 text-xs">
                      No image
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="font-medium text-espresso-700">{product.name}</div>
                  <div className="text-sm text-espresso-400">{product.category?.name}</div>
                </td>
                <td className="p-4 text-espresso-600">{product.styleCode}</td>
                <td className="p-4 text-espresso-600">${Number(product.price).toLocaleString()}</td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 text-sm ${
                      product.stock > 10
                        ? 'bg-green-100 text-green-700'
                        : product.stock > 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {product.stock}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`px-3 py-1 text-sm ${
                      product.isActive
                        ? 'bg-espresso-100 text-espresso-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
        <td className="p-4">
          <button
            onClick={() => setEditingProduct(product)}
            className="text-espresso-500 hover:text-espresso-700 mr-4"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(product.id)}
            className="text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-espresso-600">
          Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} products
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-espresso-300 text-espresso-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cream-200"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
            className="px-4 py-2 border border-espresso-300 text-espresso-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cream-200"
          >
            Next
          </button>
        </div>
      </div>

      {showCreateModal && (
        <ProductFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchProducts();
          }}
        />
      )}

      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}
    </div>
  );

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchProducts();
      } else {
        alert('Failed to delete product');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete product');
    }
  }
}

function ProductFormModal({
  product,
  onClose,
  onSuccess,
}: {
  product?: Product;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    styleCode: product?.styleCode || '',
    description: product?.description || '',
    price: product?.price || '',
    stock: product?.stock || 0,
    categoryId: product?.categoryId || '',
    materials: '',
    dimensions: product?.dimensions || '',
    careInstructions: product?.careInstructions || '',
    images: product?.images?.join(', ') || '',
    isActive: product?.isActive ?? true,
    isFeatured: product?.isFeatured ?? false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('adminToken');
      const url = product ? `/api/products/${product.id}` : '/api/products';
      const method = product ? 'PUT' : 'POST';

      const body = {
        ...formData,
        price: Number(formData.price),
        materials: (formData.materials || '').split(',').map(m => m.trim()).filter(Boolean),
        images: (formData.images || '').split(',').map(i => i.trim()).filter(Boolean),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to save product');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-espresso-200 p-6 flex justify-between items-center">
          <h3 className="text-xl font-serif text-espresso-700">
            {product ? 'Edit Product' : 'Create Product'}
          </h3>
          <button onClick={onClose} className="text-espresso-600 hover:text-espresso-800 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-espresso-700 mb-2">
                Product Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-espresso-700 mb-2">
                Style Code
              </label>
              <input
                type="text"
                value={formData.styleCode}
                onChange={(e) => setFormData({ ...formData, styleCode: e.target.value })}
                className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-espresso-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-espresso-700 mb-2">Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-espresso-700 mb-2">Stock</label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value, 10) || 0 })}
                className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-espresso-700 mb-2">
              Materials (comma-separated)
            </label>
            <input
              type="text"
              value={formData.materials}
              onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
              placeholder="Leather, Canvas, Gold Hardware"
              className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-espresso-700 mb-2">
              Image URLs (comma-separated)
            </label>
            <textarea
              value={formData.images}
              onChange={(e) => setFormData({ ...formData, images: e.target.value })}
              rows={2}
              placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
              className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
              required
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-espresso-700">Active</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-espresso-700">Featured</span>
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-espresso-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-espresso-300 text-espresso-700 hover:bg-cream-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-espresso-500 text-cream-100 hover:bg-espresso-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}