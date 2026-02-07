// components/admin/NotificationsSender.tsx
'use client';

import React, { useState } from 'react';

export function NotificationsSender() {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    userId: '',
    broadcast: false,
    data: '',
  });

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);

    try {
      // Validate required fields
      if (!formData.title.trim() || !formData.body.trim()) {
        setMessage({
          type: 'error',
          text: 'Title and body are required',
        });
        return;
      }

      // Validate userId when not broadcast
      if (!formData.broadcast && !formData.userId.trim()) {
        setMessage({
          type: 'error',
          text: 'User ID is required for targeted notifications',
        });
        return;
      }

      const token = localStorage.getItem('adminToken');
      if (!token) {
        setMessage({
          type: 'error',
          text: 'Authentication token not found',
        });
        return;
      }

      let dataObj = {};
      if (formData.data) {
        try {
          dataObj = JSON.parse(formData.data);
        } catch {
          setMessage({
            type: 'error',
            text: 'Invalid JSON in custom data',
          });
          return;
        }
      }

      setSending(true);

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          body: formData.body,
          userId: formData.broadcast ? undefined : formData.userId || undefined,
          broadcast: formData.broadcast,
          data: dataObj,
        }),
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Notification sent successfully!',
        });

        setFormData({
          title: '',
          body: '',
          userId: '',
          broadcast: false,
          data: '',
        });
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to send notification. Please try again.',
        });
      }
    } catch (error) {
      console.error('Send error:', error);
      setMessage({
        type: 'error',
        text: 'Failed to send notification. Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-serif text-espresso-500 mb-6">Send Push Notification</h2>

      <div className="bg-white border border-espresso-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={formData.broadcast}
                onChange={(e) => setFormData({ ...formData, broadcast: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-espresso-700">
                Broadcast to all users
              </span>
            </label>
          </div>

          {!formData.broadcast && (
            <div>
              <label className="block text-sm font-medium text-espresso-700 mb-2">
                User ID (Required for targeted notifications)
              </label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
                placeholder="Enter user ID to send to a specific user"
              />
              <p className="text-xs text-espresso-400 mt-1">
                Enter a user ID to send to a specific user
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-espresso-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
              placeholder="e.g., New Collection Launched!"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-espresso-700 mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={4}
              className="w-full border border-espresso-300 p-3 focus:outline-none focus:border-espresso-500"
              placeholder="Explore our newest luxury handbags..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-espresso-700 mb-2">
              Custom Data (JSON, Optional)
            </label>
            <textarea
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              rows={3}
              className="w-full border border-espresso-300 p-3 font-mono text-sm focus:outline-none focus:border-espresso-500"
              placeholder='{"type": "product", "productId": "abc123"}'
            />
            <p className="text-xs text-espresso-400 mt-1">
              Add custom data to handle navigation in the app (must be valid JSON)
            </p>
          </div>

          {message && (
            <div
              className={`p-4 ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t border-espresso-200">
            <button
              type="button"
              onClick={() =>
                setFormData({
                  title: '',
                  body: '',
                  userId: '',
                  broadcast: false,
                  data: '',
                })
              }
              className="px-6 py-3 border border-espresso-300 text-espresso-700 hover:bg-cream-200"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-6 py-3 bg-espresso-500 text-cream-100 hover:bg-espresso-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 p-6 bg-cream-200 border border-espresso-200">
        <h3 className="font-medium text-espresso-700 mb-3">Quick Templates</h3>
        <div className="space-y-2">
          <button
            onClick={() =>
              setFormData({
                ...formData,
                title: 'New Arrivals',
                body: 'Discover our latest collection of luxury handbags. Shop now!',
                data: '{"type": "collection", "featured": true}',
              })
            }
            className="block w-full text-left p-3 bg-white border border-espresso-200 hover:bg-cream-100 text-espresso-700"
          >
            <div className="font-medium">New Arrivals</div>
            <div className="text-sm text-espresso-400">Notify about new collection</div>
          </button>

          <button
            onClick={() =>
              setFormData({
                ...formData,
                title: 'Order Update',
                body: 'Your order has been shipped and is on its way!',
                data: '{"type": "order_status", "status": "shipped"}',
              })
            }
            className="block w-full text-left p-3 bg-white border border-espresso-200 hover:bg-cream-100 text-espresso-700"
          >
            <div className="font-medium">Order Shipped</div>
            <div className="text-sm text-espresso-400">Order status notification</div>
          </button>

          <button
            onClick={() =>
              setFormData({
                ...formData,
                title: 'Limited Edition Drop',
                body: 'Exclusive piece now available. Limited quantities.',
                data: '{"type": "product", "limited": true}',
              })
            }
            className="block w-full text-left p-3 bg-white border border-espresso-200 hover:bg-cream-100 text-espresso-700"
          >
            <div className="font-medium">Limited Edition</div>
            <div className="text-sm text-espresso-400">Exclusive product launch</div>
          </button>
        </div>
      </div>
    </div>
  );
}


