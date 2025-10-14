const fs = require('fs');

console.log('🔧 Fixing ALL SQL quote syntax errors in tasks.js...');

const tasksPath = './routes/tasks.js';
let content = fs.readFileSync(tasksPath, 'utf8');

// Fix all SQL queries with status values - use double quotes for SQL values
content = content.replace(
  /status = 'active'/g,
  'status = "active"'
);

content = content.replace(
  /status = 'cancelled'/g,
  'status = "cancelled"'
);

content = content.replace(
  /status = 'completed'/g,
  'status = "completed"'
);

content = content.replace(
  /status = 'pending'/g,
  'status = "pending"'
);

content = content.replace(
  /status = 'in_progress'/g,
  'status = "in_progress"'
);

// Fix comment insertion column name
content = content.replace(
  /INSERT INTO task_comments \(task_id, comment_text, created_by\)/g,
  'INSERT INTO task_comments (task_id, comment_text, user_id)'
);

// Fix specific broken lines
content = content.replace(
  /'UPDATE tasks SET status = 'cancelled' WHERE id = \?'/g,
  '"UPDATE tasks SET status = \'cancelled\' WHERE id = ?"'
);

content = content.replace(
  /'UPDATE tasks SET status = 'completed' WHERE id = \?'/g,
  '"UPDATE tasks SET status = \'completed\' WHERE id = ?"'
);

fs.writeFileSync(tasksPath, content);
console.log('✅ Fixed ALL SQL quote syntax errors!');
console.log('🚀 Restart server: node server.js');