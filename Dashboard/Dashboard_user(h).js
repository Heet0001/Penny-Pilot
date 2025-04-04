// This file implements the user profile menu functionality
// Save this as Dashboard_user.js

document.addEventListener('DOMContentLoaded', function() {
    // Get the profile icon element
    const profileIcon = document.getElementById('profile-icon');
    
    // Get the username from localStorage (assuming it was stored during login)
    const username = localStorage.getItem('username') || 'User';
    
    // Set the username in the tooltip
    const usernameTooltip = document.getElementById('username-tooltip');
    usernameTooltip.textContent = username;
    
    // Create a dropdown menu element
    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';
    dropdown.style.display = 'none';
    
    // Add dropdown menu items
    dropdown.innerHTML = `
        <div class="dropdown-item" id="settings-btn">Settings</div>
        <div class="dropdown-item" id="logout-btn">Logout</div>
    `;
    
    // Append the dropdown menu to the profile container
    document.querySelector('.profile-container').appendChild(dropdown);
    
    // Toggle dropdown visibility when profile icon is clicked
    let isDropdownVisible = false;
    
    profileIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        isDropdownVisible = !isDropdownVisible;
        dropdown.style.display = isDropdownVisible ? 'block' : 'none';
    });
    
    // Hide dropdown when clicking elsewhere on the page
    document.addEventListener('click', function() {
        dropdown.style.display = 'none';
        isDropdownVisible = false;
    });
    
    // Prevent dropdown from closing when clicking inside it
    dropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Handle logout button click
    document.getElementById('logout-btn').addEventListener('click', function() {
        // Clear any user-related data from localStorage
        localStorage.removeItem('username');
        localStorage.removeItem('userToken');
        
        // Redirect to login page
        window.location.href = '../Loginpage/Login.html';
    });
    
    // Handle settings button click
    document.getElementById('settings-btn').addEventListener('click', function() {
        // You can implement settings functionality here
        alert('Settings functionality will be implemented in future updates.');
    });
});