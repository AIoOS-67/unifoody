'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price_usd: number;
  price_foody?: number;
  category: string;
  image_url?: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface MenuManagementProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
}

export function MenuManagement({ isOpen, onClose, restaurantId }: MenuManagementProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price_usd: 0,
    category: '',
    is_available: true
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [categories, setCategories] = useState<string[]>(['Appetizers', 'Main Course', 'Desserts', 'Beverages']);

  useEffect(() => {
    if (isOpen) {
      fetchMenuItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, restaurantId]);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching menu items:', error);
        return;
      }

      setMenuItems(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map((item: any) => item.category as string) || [])] as string[];
      if (uniqueCategories.length > 0) {
        setCategories(prev => [...new Set([...prev, ...uniqueCategories])] as string[]);
      }
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveNewItem = async () => {
    if (!newItem.name || !newItem.price_usd || !newItem.category) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('menu_items')
        .insert([{
          ...newItem,
          restaurant_id: restaurantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating menu item:', error);
        alert('Failed to create menu item');
        return;
      }

      setMenuItems([...menuItems, data]);
      setNewItem({
        name: '',
        description: '',
        price_usd: 0,
        category: '',
        is_available: true
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create menu item:', error);
      alert('Failed to create menu item');
    }
  };

  const updateItem = async (item: MenuItem) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({
          ...item,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) {
        console.error('Error updating menu item:', error);
        alert('Failed to update menu item');
        return;
      }

      setMenuItems(menuItems.map(menuItem => 
        menuItem.id === item.id ? { ...item, updated_at: new Date().toISOString() } : menuItem
      ));
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update menu item:', error);
      alert('Failed to update menu item');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Error deleting menu item:', error);
        alert('Failed to delete menu item');
        return;
      }

      setMenuItems(menuItems.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      alert('Failed to delete menu item');
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    await updateItem({ ...item, is_available: !item.is_available });
  };

  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-6xl w-full h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Menu Management
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-[#222c4e] hover:bg-[#454b80] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Plus size={18} />
              <span>Add Item</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Add New Item Form */}
        {showAddForm && (
          <div className="p-6 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Menu Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={newItem.name || ''}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white"
                  placeholder="Burger Deluxe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={newItem.category || ''}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.price_usd || 0}
                  onChange={(e) => setNewItem({ ...newItem, price_usd: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white"
                  placeholder="12.99"
                />
              </div>
              
              <div className="flex items-end space-x-2">
                <button
                  onClick={saveNewItem}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <Save size={18} />
                  <span>Save</span>
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <X size={18} />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={newItem.description || ''}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white"
                rows={2}
                placeholder="Delicious burger with fresh ingredients..."
              />
            </div>
          </div>
        )}

        {/* Menu Items List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#222c4e]"></div>
            </div>
          ) : Object.keys(groupedItems).length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No menu items found. Add your first item to get started!
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    {category} ({items.length})
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 border ${
                          !item.is_available ? 'opacity-60' : ''
                        } border-gray-200 dark:border-gray-700`}
                      >
                        {editingItem === item.id ? (
                          <EditItemForm
                            item={item}
                            onSave={updateItem}
                            onCancel={() => setEditingItem(null)}
                            categories={categories}
                          />
                        ) : (
                          <ViewItem
                            item={item}
                            onEdit={() => setEditingItem(item.id)}
                            onDelete={() => deleteItem(item.id)}
                            onToggleAvailability={() => toggleAvailability(item)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function ViewItem({ 
  item, 
  onEdit, 
  onDelete, 
  onToggleAvailability 
}: { 
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
}) {
  return (
    <>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
          {item.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            ${item.price_usd.toFixed(2)}
          </div>
          <div className={`text-xs px-2 py-1 rounded-full ${
            item.is_available 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            {item.is_available ? 'Available' : 'Unavailable'}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleAvailability}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            item.is_available
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {item.is_available ? 'Mark Unavailable' : 'Mark Available'}
        </button>
        
        <div className="flex space-x-2">
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

function EditItemForm({ 
  item, 
  onSave, 
  onCancel, 
  categories 
}: { 
  item: MenuItem;
  onSave: (item: MenuItem) => void;
  onCancel: () => void;
  categories: string[];
}) {
  const [editedItem, setEditedItem] = useState(item);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Name
        </label>
        <input
          type="text"
          value={editedItem.name}
          onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white text-sm"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={editedItem.description}
          onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white text-sm"
          rows={2}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category
          </label>
          <select
            value={editedItem.category}
            onChange={(e) => setEditedItem({ ...editedItem, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white text-sm"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Price (USD)
          </label>
          <input
            type="number"
            step="0.01"
            value={editedItem.price_usd}
            onChange={(e) => setEditedItem({ ...editedItem, price_usd: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#222c4e] focus:border-transparent dark:bg-zinc-900 dark:text-white text-sm"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 pt-2">
        <button
          onClick={() => onSave(editedItem)}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors flex items-center space-x-1"
        >
          <Save size={14} />
          <span>Save</span>
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors flex items-center space-x-1"
        >
          <X size={14} />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}
