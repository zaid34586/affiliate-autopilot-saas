cd C:\Users\mz712\affiliate-autopilot-saas\apps\web
npx eslint . --ext .ts,.tsx 2>&1 | Select-String "optimizer-dashboard" | Select-Object -First 20