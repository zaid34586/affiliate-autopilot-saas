#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/(app)/dashboard/optimizer/optimizer-dashboard.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF
const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Write back with LF line endings
fs.writeFileSync(filePath, normalizedContent, 'utf8');
console.log('File normalized to LF line endings');