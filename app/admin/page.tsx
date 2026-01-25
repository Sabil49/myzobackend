// app/admin/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductsManager } from '@/components/admin/ProductsManager';
import { OrdersManager } from '@/components/admin/OrdersManager';
import { NotificationsSender } from '@/components/admin/NotificationsSender';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'notifications'>('products');

  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          router.push('/login');
          return;
        }

        // Verify token is valid by making a protected request
        const response = await fetch('/api/admin/products?page=1&limit=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          router.push('/login');
          return;
        }

        if (response.status === 403) {
          setIsAuthenticated(true);
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        if (response.ok) {
          setIsAuthenticated(true);
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // Other errors
        router.push('/login');
      } catch (error) {
        console.error('Auth verification failed:', error);
        router.push('/login');
      }
    };

    verifyAdmin();
  }, [router]);

  if (isLoading) {
    return <div className="p-8 text-center">Verifying access...</div>;
  }

  if (!isAuthenticated) {
    return <div className="p-8 text-center">Redirecting to login...</div>;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-cream-200 p-8 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-gray-600">You do not have permission to access the admin dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-200">
      <nav className="bg-espresso-500 text-cream-100 p-4">
        <h1 className="text-2xl font-serif">Luxury Bags Admin</h1>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-white h-screen p-4">
          <button
            onClick={() => setActiveTab('products')}
            className={`w-full text-left p-3 mb-2 ${
              activeTab === 'products' ? 'bg-espresso-100' : ''
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full text-left p-3 mb-2 ${
              activeTab === 'orders' ? 'bg-espresso-100' : ''
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full text-left p-3 ${
              activeTab === 'notifications' ? 'bg-espresso-100' : ''
            }`}
          >
            Notifications
          </button>
        </aside>

        <main className="flex-1 p-8">
          {activeTab === 'products' && <ProductsManager />}
          {activeTab === 'orders' && <OrdersManager />}
          {activeTab === 'notifications' && <NotificationsSender />}
        </main>
      </div>
    </div>
  );
}