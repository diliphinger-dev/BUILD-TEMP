const fs = require('fs');

const fixes = [
  { from: /CURDATE\(\)/g, to: "DATE('now')" },
  { from: /NOW\(\)/g, to: "DATETIME('now')" },
  { from: /"active"/g, to: "'active'" },
  { from: /"paid"/g, to: "'paid'" }
];

const files = ['routes/billing.js', 'routes/clients.js', 'routes/staff.js'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    fixes.forEach(fix => {
      content = content.replace(fix.from, fix.to);
    });
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
  }
});

console.log('SQLite conversion complete!');