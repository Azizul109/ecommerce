const express = require('express');
const { Order, OrderItem, Product } = require('../models');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Create order
router.post('/', auth, async (req, res) => {
  try {
    const { items, shipping_address, billing_address, payment_method } = req.body;
    
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const product = await Product.findByPk(item.product_id);
      if (!product) {
        return res.status(400).json({ message: `Product ${item.product_id} not found` });
      }
      
      if (product.quantity < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient quantity for ${product.name}. Available: ${product.quantity}`
        });
      }
      
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal
      });
    }
    
    // Generate order number
    const orderNumber = 'ORD' + Date.now();
    
    // Create order
    const order = await Order.create({
      order_number: orderNumber,
      total_amount: totalAmount,
      shipping_address,
      billing_address: billing_address || shipping_address,
      payment_method,
      user_id: req.user.id
    });
    
    // Create order items and update product quantities
    for (const item of orderItems) {
      await OrderItem.create({
        ...item,
        order_id: order.id
      });
      
      // Update product quantity
      const product = await Product.findByPk(item.product_id);
      await product.update({
        quantity: product.quantity - item.quantity
      });
    }
    
    const completeOrder = await Order.findByPk(order.id, {
      include: [{
        model: OrderItem,
        include: [Product]
      }]
    });
    
    res.status(201).json(completeOrder);
  } catch (error) {
    res.status(400).json({ message: 'Error creating order', error: error.message });
  }
});

// Get user orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      include: [{
        model: OrderItem,
        include: [Product]
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { 
        id: req.params.id,
        user_id: req.user.id 
      },
      include: [{
        model: OrderItem,
        include: [Product]
      }]
    });
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;