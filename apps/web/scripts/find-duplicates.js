import fs from 'fs';
const content = fs.readFileSync('../src/lib/copilot/copilot.ts', 'utf8');
const lines = content.split('\n');

const exports = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('export async function copilotChat') || 
      line.startsWith('export {') ||
      line.startsWith('export type')) {
    console.log(i + 1, ':', line);
  }
}