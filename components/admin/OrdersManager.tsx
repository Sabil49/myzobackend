'use client';

import React, { useState, useEffect } from 'react';

interface OrderItem {
  product: {
    name: string;
    styleCode: string;
  };
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  items: OrderItem[];
  total: number;
  status: string;
  trackingNumber?: string;
  carrier?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-gold-100 text-gold-700',
  CONFIRMED: 'bg-espresso-100 text-espresso-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  REFUNDED: 'bg-red-100 text-red-700',
};

export function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No auth token found');
        setOrders([]);
        setLoading(false);
        return;
      }

      const url = `/api/admin/orders${statusFilter ? `?status=${statusFilter}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch orders:', response.status);
        setOrders([]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setOrders(data?.orders ?? []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  if (loading) {
    return <div className="p-8 text-center">Loading orders...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-serif text-espresso-500">Orders</h2>
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-espresso-300 px-4 py-2 focus:outline-none focus:border-espresso-500"
          >
            <option value="">All Statuses</option>
            <option value="PLACED">Placed</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-espresso-200">
        <table className="w-full">
          <thead className="border-b border-espresso-200">
            <tr>
              <th className="text-left p-4 font-medium text-espresso-700">Order #</th>
              <th className="text-left p-4 font-medium text-espresso-700">Customer</th>
              <th className="text-left p-4 font-medium text-espresso-700">Date</th>
              <th className="text-left p-4 font-medium text-espresso-700">Items</th>
              <th className="text-left p-4 font-medium text-espresso-700">Total</th>
              <th className="text-left p-4 font-medium text-espresso-700">Status</th>
              <th className="text-left p-4 font-medium text-espresso-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-espresso-100 hover:bg-cream-200">
                <td className="p-4">
                  <div className="font-medium text-espresso-700">{order.orderNumber}</div>
                </td>
                <td className="p-4">
                  <div className="font-medium text-espresso-700">
                    {order.user.firstName} {order.user.lastName}
                  </div>
                  <div className="text-sm text-espresso-400">{order.user.email}</div>
                </td>
                <td className="p-4 text-espresso-600">
                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="p-4 text-espresso-600">{order.items.length}</td>
                <td className="p-4 text-espresso-600">${Number(order.total).toFixed(2)}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 text-sm ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="text-espresso-500 hover:text-espresso-700"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={fetchOrders}
        />
      )}
    </div>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onUpdate,
}: {
  order: Order;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [status, setStatus] = useState(order.status);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [carrier, setCarrier] = useState(order.carrier || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status, trackingNumber, carrier, notes }),
      });

      if (response.ok) {
        onUpdate();
        onClose();
      } else {
        alert('Failed to update order status');
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-espresso-200 p-6 flex justify-between items-center">
          <h3 className="text-xl font-serif text-espresso-700">Order {order.orderNumber}</h3>
          <button onClick={onClose} className="text-espresso-600 hover:text-espresso-800 text-2xl">
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-espresso-700 mb-2">Customer Information</h4>
              <p className="text-espresso-600">
                {order.user.firstName} {order.user.lastName}
              </p>
              <p className="text-sm text-espresso-400">{order.user.email}</p>
            </div>

            <div>
              <h4 className="font-medium text-espresso-700 mb-2">Order Details</h4>
              <p className="text-espresso-600">
                Date: {new Date(order.createdAt).toLocaleDateString()}
              </p>
              <p className="text-espresso-600">Total: ${Number(order.total).toFixed(2)}</p>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-espresso-700 mb-3">Items</h4>
            <div className="space-y-2">
              {order.items.map((item: OrderItem, index: number) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-cream-200 border border-espresso-100"
                >
                  <div>
                    <p className="font-medium text-espresso-700">{item.product.name}</p>
                    <p className="text-sm text-espresso-400">{item.product.styleCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-espresso-600">Qty: {item.quantity}</p>
                    <p className="font-medium text-espresso-700">
                      ${Number(item.price).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-espresso-200 pt-6">
            <h4 className="font-medium text-espresso-700 mb-4">Update Order Status</h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-espresso-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                >
                  <option value="PLACED">Placed</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>

              {status === 'SHIPPED' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-espresso-700 mb-2">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                      placeholder="Enter tracking number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-espresso-700 mb-2">
                      Carrier
                    </label>
                    <input
                      type="text"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                      placeholder="e.g., FedEx, UPS, USPS"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-espresso-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                  placeholder="Add any notes about this status update"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-espresso-200">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-espresso-300 text-espresso-700 hover:bg-cream-200"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateStatus}
              disabled={loading}
              className="px-6 py-3 bg-espresso-500 text-cream-100 hover:bg-espresso-600 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}