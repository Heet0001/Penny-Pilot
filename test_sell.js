// Test script to verify sell functionality
// Run this with: node test_sell.js

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Test data - replace with actual values from your database
const testData = {
  user_id: 1, // Replace with actual user ID
  investment_id: 1, // Replace with actual investment ID
  sell_price: 150.00,
  sell_quantity: 5,
  sell_date: '2025-01-18',
  partial_sale: false
};

async function testSellStock() {
  try {
    console.log('Testing sell stock functionality...');
    console.log('Test data:', testData);
    
    const response = await fetch(`${BASE_URL}/api/sell-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('✅ Sell stock test PASSED');
      console.log('Sale amount:', data.data.total_sale_amount);
      console.log('Profit/Loss:', data.data.profit);
    } else {
      console.log('❌ Sell stock test FAILED');
      console.log('Error:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testSellStock();
