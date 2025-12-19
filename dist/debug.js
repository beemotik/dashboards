// Debug script to check URL handling
console.log('=== DEBUG INFO ===');
console.log('Current URL:', window.location.href);
console.log('Pathname:', window.location.pathname);
console.log('Search:', window.location.search);
console.log('Hash:', window.location.hash);

// Parse query parameters
const params = new URLSearchParams(window.location.search);
console.log('tenant_id:', params.get('tenant_id'));
console.log('All params:', Object.fromEntries(params));

// Check if React app is loading
setTimeout(() => {
  const root = document.getElementById('root');
  console.log('React root element:', root);
  console.log('React root content:', root ? root.innerHTML.substring(0, 100) : 'Not found');
}, 1000);