const fs = require('fs');

console.log('🔧 Fixing SQL quote syntax errors in tasks.js...');

const tasksPath = './routes/tasks.js';
let content = fs.readFileSync(tasksPath, 'utf8');

// Fix the broken single quotes in SQL strings - use proper escaping or double quotes for SQL values
// Fix 1: Staff status check with proper SQL escaping
content = content.replace(
  /'SELECT id FROM staff WHERE name LIKE \? AND status = 'active' LIMIT 1'/g,
  "'SELECT id FROM staff WHERE name LIKE ? AND status = \"active\" LIMIT 1'"
);

// Fix 2: Another staff check
content = content.replace(
  /'SELECT id, name FROM staff WHERE id = \? AND status = 'active''/g,
  "'SELECT id, name FROM staff WHERE id = ? AND status = \"active\"'"
);

// Fix 3: Comment insertion - change created_by to user_id
content = content.replace(
  /INSERT INTO task_comments \(task_id, comment_text, created_by\)/g,
  'INSERT INTO task_comments (task_id, comment_text, user_id)'
);

// Fix 4: Fix any other similar issues
content = content.replace(
  /'SELECT \* FROM staff WHERE id = \? AND status = 'active''/g,
  "'SELECT * FROM staff WHERE id = ? AND status = \"active\"'"
);

fs.writeFileSync(tasksPath, content);
console.log('✅ Fixed SQL quote syntax errors!');