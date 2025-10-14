const fs = require('fs');
const path = require('path');

const files = [
  'routes/billing.js',
  'routes/clients.js', 
  'routes/staff.js',
  'routes/firms.js',
  'routes/admin.js'
];

const conversions = [
  { from: /CURDATE\(\)/g, to: "DATE('now')" },
  { from: /NOW\(\)/g, to: "DATETIME('now')" },
  { from: /"active"/g, to: "'active'" },
  { from: /"pending"/g, to: "'pending'" },
  { from: /"paid"/g, to: "'paid'" }
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    conversions.forEach(conv => {
      content = content.replace(conv.from, conv.to);
    });
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
  }
});
console.log('Route conversion complete!');