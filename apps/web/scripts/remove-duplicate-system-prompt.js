const fs = require('fs');
const content = fs.readFileSync('../src/lib/copilot/copilot.ts', 'utf8');
const lines = content.split('\n');

let count = 0;
let secondStart = -1;
let secondEnd = -1;
let inTemplate = false;
let backtickCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.trim().startsWith('const SYSTEM_PROMPT')) {
    if (count === 1) {
      secondStart = i;
      inTemplate = true;
    }
    count++;
  }
  
  if (inTemplate) {
    // Count backticks in this line
    for (const char of line) {
      if (char === '`') backtickCount++;
    }
    
    // Template literal ends when we have an even number of backticks (2 for the opening and closing)
    if (backtickCount >= 2) {
      secondEnd = i;
      break;
    }
  }
}

console.log('Second SYSTEM_PROMPT start:', secondStart + 1);
console.log('Second SYSTEM_PROMPT end:', secondEnd + 1);

if (secondStart > 0 && secondEnd > 0) {
  const newLines = lines.slice(0, secondStart).concat(lines.slice(secondEnd + 1));
  fs.writeFileSync('../src/lib/copilot/copilot.ts', newLines.join('\n'));
  console.log('Removed duplicate SYSTEM_PROMPT definition');
} else {
  console.log('Could not find second SYSTEM_PROMPT definition');
}