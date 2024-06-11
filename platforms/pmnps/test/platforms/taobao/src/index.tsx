import React from 'react';
import { render } from 'react-dom';

const root = document.getElementById('root');

if (root) {
  render(<div style={{ textAlign: 'center', marginTop: 20 }}>test</div>, root);
}
