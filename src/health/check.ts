import { checkHealth } from './index.js';

const logDir = process.env.LOG_DIR || './data/logs';
const healthy = checkHealth(logDir);

if (healthy) {
  console.log('healthy');
  process.exit(0);
} else {
  console.log('unhealthy');
  process.exit(1);
}
