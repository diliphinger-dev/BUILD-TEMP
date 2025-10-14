const fs = require('fs');

console.log('🔧 Fixing async function syntax in tasks.js...');

const tasksPath = './routes/tasks.js';
let content = fs.readFileSync(tasksPath, 'utf8');

// Find the problematic router.post line and ensure it has async
content = content.replace(
  /router\.post\('\/', requireAuth, \(req, res\) => \{/g,
  "router.post('/', requireAuth, async (req, res) => {"
);

// Also fix any other missing async keywords
content = content.replace(
  /router\.post\('\/', requireAuth, async \(req, res\) => \{/g,
  "router.post('/', requireAuth, async (req, res) => {"
);

fs.writeFileSync(tasksPath, content);
console.log('✅ Fixed async function syntax!');