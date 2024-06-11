module.exports = (mode, custom) => ({
  NODE_ENV: JSON.stringify(mode === 'development' ? mode : 'production'),
  history: JSON.stringify('hash'),
  custom: custom ? JSON.stringify(custom) : 'undefined',
  inside: mode === 'inside',
  AGENT_REDUCER_EXPERIENCE: JSON.stringify('OPEN')
});
