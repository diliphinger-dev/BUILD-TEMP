const fs = require('fs');

console.log('🔧 Fixing comment and reassignment errors in tasks.js...');

const tasksPath = './routes/tasks.js';
let content = fs.readFileSync(tasksPath, 'utf8');

// Fix 1: Change created_by to user_id in comment insertion
content = content.replace(
  /INSERT INTO task_comments \(task_id, comment_text, created_by\)/g,
  'INSERT INTO task_comments (task_id, comment_text, user_id)'
);

// Fix 2: Change double quotes to single quotes for 'active'
content = content.replace(
  /status = "active"/g,
  "status = 'active'"
);

// Fix 3: Also fix any other double quotes in SQL that should be single quotes
content = content.replace(
  /status = "cancelled"/g,
  "status = 'cancelled'"
);

content = content.replace(
  /status = "completed"/g,
  "status = 'completed'"
);

fs.writeFileSync(tasksPath, content);
console.log('✅ Fixed comment and reassignment errors!');
console.log('');
console.log('Changes made:');
console.log('1. Fixed comment insertion: created_by → user_id');
console.log('2. Fixed SQL quotes: "active" → \'active\'');
console.log('3. Fixed other SQL string literals');